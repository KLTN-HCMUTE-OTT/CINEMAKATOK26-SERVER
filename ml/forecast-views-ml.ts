import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { Client } from 'pg';

type TimeSeriesPoint = {
  day: string;
  views: number;
};

type ContentInfo = {
  id: string;
  title: string;
  type: string;
};

type ForecastRecord = {
  contentId: string;
  title: string;
  contentType: string;
  historyViews: TimeSeriesPoint[];
  last7Avg: number;
  next7DaysViews: number[];
  totalForecast7d: number;
  predictedTrend: 'up' | 'down';
  mae: number | null;
  mape: number | null;
  confidence: number;
};

type TrainingSample = {
  features: number[];
  target: number;
};

type XGBoostModelPayload = {
  name: 'ml-xgboost';
  model: number[];
  options: Record<string, unknown>;
};

type XGBoostForecastModel = {
  modelType: 'xgboost';
  featureNames: string[];
  lagDays: number[];
  targetTransform: 'log1p';
  trainedSamples: number;
  trainedAt: string;
  params: Record<string, string | number>;
  booster: XGBoostModelPayload;
};

type ModelRecord = {
  contentId: string;
  title: string;
  contentType: string;
  model: XGBoostForecastModel | null;
};

type XGBoostBooster = {
  train: (trainingSet: number[][], trainingValues: number[]) => void;
  predict: (toPredict: number[][]) => number[];
  toJSON: () => XGBoostModelPayload;
  free: () => void;
};

type XGBoostCtor = {
  new (options: Record<string, unknown>): XGBoostBooster;
  load: (model: XGBoostModelPayload) => XGBoostBooster;
};

const LOOKBACK_DAYS = 30;
const HORIZON_DAYS = 7;
const ROLLING_BACKTEST_WINDOWS = 3;
const MIN_TRAIN_SAMPLES = 10;
const MODEL_LAG_DAYS = [1, 2, 3, 7, 14];

const XGB_PARAMS = {
  booster: 'gbtree',
  objective: 'reg:linear',
  max_depth: 4,
  eta: 0.08,
  min_child_weight: 1,
  subsample: 0.85,
  colsample_bytree: 0.85,
  silent: 1,
  iterations: 160,
};

const requiredEnv = [
  'CONTENT_DB_HOST',
  'CONTENT_DB_PORT',
  'CONTENT_DB_USERNAME',
  'CONTENT_DB_PASSWORD',
  'CONTENT_DB_NAME',
  'AUDIT_DB_HOST',
  'AUDIT_DB_PORT',
  'AUDIT_DB_USERNAME',
  'AUDIT_DB_PASSWORD',
  'AUDIT_DB_NAME',
];

let xgboostLoader: Promise<XGBoostCtor> | null = null;

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function ensureRequiredEnv() {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function buildClient(prefix: 'CONTENT' | 'AUDIT') {
  return new Client({
    host: process.env[`${prefix}_DB_HOST`],
    port: Number(process.env[`${prefix}_DB_PORT`] || 5432),
    user: process.env[`${prefix}_DB_USERNAME`],
    password: process.env[`${prefix}_DB_PASSWORD`],
    database: process.env[`${prefix}_DB_NAME`],
  });
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayRange(days: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    result.push(dateKey(day));
  }
  return result;
}

function movingAverage(values: number[], window: number): number {
  if (values.length === 0) {
    return 0;
  }
  const start = Math.max(0, values.length - window);
  const segment = values.slice(start);
  return segment.reduce((acc, x) => acc + x, 0) / Math.max(1, segment.length);
}

function baseFeatureNames(): string[] {
  return [
    ...MODEL_LAG_DAYS.map((lag) => `lag_${lag}`),
    'ma_3',
    'ma_7',
    'momentum_1_7',
    'weekday_sin',
    'weekday_cos',
  ];
}

function buildFeatureVector(history: number[], targetIndex: number): number[] {
  const lastKnown = history[targetIndex - 1] ?? 0;
  const lagFeatures = MODEL_LAG_DAYS.map((lag) => {
    const idx = targetIndex - lag;
    return idx >= 0 ? history[idx] : lastKnown;
  });

  const recent = history.slice(Math.max(0, targetIndex - 7), targetIndex);
  const ma3 = movingAverage(recent, 3);
  const ma7 = movingAverage(recent, 7);
  const lag1 = lagFeatures[0] ?? 0;
  const lag7 = lagFeatures[3] ?? lag1;
  const momentum = lag1 - lag7;
  const weekday = targetIndex % 7;
  const angle = (2 * Math.PI * weekday) / 7;

  return [...lagFeatures, ma3, ma7, momentum, Math.sin(angle), Math.cos(angle)];
}

function createTrainingSet(values: number[]): TrainingSample[] {
  const maxLag = Math.max(...MODEL_LAG_DAYS);
  const samples: TrainingSample[] = [];
  for (let i = maxLag; i < values.length; i += 1) {
    samples.push({
      features: buildFeatureVector(values, i),
      target: values[i],
    });
  }
  return samples;
}

function fallbackForecast(values: number[], horizon: number): number[] {
  const avg = Math.round(movingAverage(values, Math.min(7, values.length)));
  return Array.from({ length: horizon }, () => Math.max(0, avg));
}

async function getXGBoostCtor(): Promise<XGBoostCtor> {
  if (!xgboostLoader) {
    const modulePromise = require('ml-xgboost') as Promise<XGBoostCtor>;
    xgboostLoader = modulePromise;
  }
  return xgboostLoader;
}

async function trainXGBoostForecastModel(
  values: number[],
): Promise<XGBoostForecastModel | null> {
  const samples = createTrainingSet(values);
  if (samples.length < MIN_TRAIN_SAMPLES) {
    return null;
  }

  const X = samples.map((sample) => sample.features);
  const y = samples.map((sample) => Math.log1p(sample.target));
  const XGBoost = await getXGBoostCtor();
  const booster = new XGBoost(XGB_PARAMS);

  try {
    booster.train(X, y);
    return {
      modelType: 'xgboost',
      featureNames: baseFeatureNames(),
      lagDays: [...MODEL_LAG_DAYS],
      targetTransform: 'log1p',
      trainedSamples: samples.length,
      trainedAt: new Date().toISOString(),
      params: XGB_PARAMS,
      booster: booster.toJSON(),
    };
  } finally {
    booster.free();
  }
}

async function predictFromModel(
  values: number[],
  horizon: number,
  model: XGBoostForecastModel | null,
): Promise<number[]> {
  if (values.length === 0) {
    return Array.from({ length: horizon }, () => 0);
  }

  if (!model) {
    return fallbackForecast(values, horizon);
  }

  const XGBoost = await getXGBoostCtor();
  const booster = XGBoost.load(model.booster);
  const history = [...values];
  const predictions: number[] = [];

  try {
    for (let step = 0; step < horizon; step += 1) {
      const targetIndex = history.length;
      const features = buildFeatureVector(history, targetIndex);
      const prediction = booster.predict([features]);
      const raw = Number(prediction[0] ?? 0);
      const next = Math.max(0, Math.round(Math.expm1(raw)));
      predictions.push(next);
      history.push(next);
    }
  } finally {
    booster.free();
  }

  return predictions;
}

function buildTrend(last7Avg: number, next7: number[]): 'up' | 'down' {
  const nextAvg =
    next7.reduce((acc, x) => acc + x, 0) / Math.max(1, next7.length);
  return nextAvg >= last7Avg ? 'up' : 'down';
}

function evaluateForecast(
  actual: number[],
  predicted: number[],
): {
  mae: number | null;
  mape: number | null;
} {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return { mae: null, mape: null };
  }

  let absErrorSum = 0;
  let absPctErrorSum = 0;
  let pctCount = 0;
  const MAPE_MIN_THRESHOLD = 5;

  for (let i = 0; i < actual.length; i += 1) {
    const a = actual[i];
    const p = predicted[i];
    absErrorSum += Math.abs(a - p);
    if (a >= MAPE_MIN_THRESHOLD) {
      absPctErrorSum += Math.abs((a - p) / a) * 100;
      pctCount += 1;
    }
  }

  return {
    mae: Number((absErrorSum / actual.length).toFixed(4)),
    mape: pctCount > 0 ? Number((absPctErrorSum / pctCount).toFixed(4)) : null,
  };
}

async function rollingBacktest(
  values: number[],
  horizon: number,
  windows: number,
): Promise<{
  mae: number | null;
  mape: number | null;
}> {
  if (values.length < horizon * 2) {
    return { mae: null, mape: null };
  }

  const maeScores: number[] = [];
  const mapeScores: number[] = [];

  for (let w = 0; w < windows; w += 1) {
    const end = values.length - w * horizon;
    const start = end - horizon;
    if (start <= horizon) {
      break;
    }

    const train = values.slice(0, start);
    const actual = values.slice(start, end);
    const model = await trainXGBoostForecastModel(train);
    const predicted = await predictFromModel(train, horizon, model);
    const score = evaluateForecast(actual, predicted);

    if (score.mae !== null) {
      maeScores.push(score.mae);
    }
    if (score.mape !== null) {
      mapeScores.push(score.mape);
    }
  }

  return {
    mae:
      maeScores.length > 0
        ? Number(
            (
              maeScores.reduce((acc, x) => acc + x, 0) / maeScores.length
            ).toFixed(4),
          )
        : null,
    mape:
      mapeScores.length > 0
        ? Number(
            (
              mapeScores.reduce((acc, x) => acc + x, 0) / mapeScores.length
            ).toFixed(4),
          )
        : null,
  };
}

function confidenceScore(mape: number | null): number {
  if (mape === null) {
    return 50;
  }

  const score = 100 - mape;
  return Math.max(10, Math.min(95, Math.round(score)));
}

async function run() {
  loadEnvFile(resolve('.env'));
  loadEnvFile(resolve('apps/content-service/.env'));
  loadEnvFile(resolve('apps/audit-log-service/.env'));
  ensureRequiredEnv();

  const contentClient = buildClient('CONTENT');
  const auditClient = buildClient('AUDIT');

  await contentClient.connect();
  await auditClient.connect();

  try {
    const days = dayRange(LOOKBACK_DAYS);
    const fromDate = days[0];

    const auditResult = await auditClient.query<{
      day: string;
      content_id: string;
      views: string;
    }>(
      `
      SELECT
        DATE_TRUNC('day', "createdAt")::date::text AS day,
        "resourceId" AS content_id,
        COUNT(*)::int::text AS views
      FROM audit_logs
      WHERE action = 'CONTENT_VIEW_INCREASED'
        AND "resourceId" IS NOT NULL
        AND "createdAt" >= $1::date
      GROUP BY day, content_id
      ORDER BY day ASC
      `,
      [fromDate],
    );

    const byContent = new Map<string, Map<string, number>>();
    for (const row of auditResult.rows) {
      if (!byContent.has(row.content_id)) {
        byContent.set(row.content_id, new Map<string, number>());
      }
      byContent.get(row.content_id)!.set(row.day, Number(row.views));
    }

    const contentIds = [...byContent.keys()];
    if (contentIds.length === 0) {
      const outputDir = resolve('exports/analytics');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(
        resolve(outputDir, 'view-forecast.json'),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            lookbackDays: LOOKBACK_DAYS,
            horizonDays: HORIZON_DAYS,
            records: [],
          },
          null,
          2,
        ),
        'utf8',
      );
      console.log(
        'No CONTENT_VIEW_INCREASED logs found. Empty forecast file created.',
      );
      return;
    }

    const contentResult = await contentClient.query<ContentInfo>(
      `SELECT id, title, type FROM content WHERE id = ANY($1::uuid[])`,
      [contentIds],
    );
    const contentMap = new Map<string, ContentInfo>(
      contentResult.rows.map((row) => [row.id, row]),
    );

    const records: ForecastRecord[] = [];
    const trainedModels: ModelRecord[] = [];
    const validMae: number[] = [];
    const validMape: number[] = [];

    for (const contentId of contentIds) {
      const content = contentMap.get(contentId);
      if (!content) {
        continue;
      }

      const viewsByDay = byContent.get(contentId)!;
      const historyViews = days.map((day) => ({
        day,
        views: viewsByDay.get(day) || 0,
      }));
      const values = historyViews.map((x) => x.views);

      const last7 = values.slice(-7);
      const last7Avg =
        last7.reduce((acc, x) => acc + x, 0) / Math.max(1, last7.length);

      const trainedModel = await trainXGBoostForecastModel(values);
      const next7DaysViews = await predictFromModel(
        values,
        HORIZON_DAYS,
        trainedModel,
      );
      const totalForecast7d = next7DaysViews.reduce((acc, x) => acc + x, 0);
      const predictedTrend = buildTrend(last7Avg, next7DaysViews);

      const rollingEval = await rollingBacktest(
        values,
        HORIZON_DAYS,
        ROLLING_BACKTEST_WINDOWS,
      );
      const mae = rollingEval.mae;
      const mape = rollingEval.mape;
      const confidence = confidenceScore(mape);

      if (mae !== null) {
        validMae.push(mae);
      }
      if (mape !== null) {
        validMape.push(mape);
      }

      trainedModels.push({
        contentId,
        title: content.title,
        contentType: content.type,
        model: trainedModel,
      });

      records.push({
        contentId,
        title: content.title,
        contentType: content.type,
        historyViews,
        last7Avg: Number(last7Avg.toFixed(2)),
        next7DaysViews,
        totalForecast7d,
        predictedTrend,
        mae,
        mape,
        confidence,
      });
    }

    records.sort((a, b) => b.totalForecast7d - a.totalForecast7d);

    const outputDir = resolve('exports/analytics');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, 'view-forecast.json');
    const modelPath = resolve(outputDir, 'view-forecast-models.json');

    writeFileSync(
      outputPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          lookbackDays: LOOKBACK_DAYS,
          horizonDays: HORIZON_DAYS,
          backtestWindows: ROLLING_BACKTEST_WINDOWS,
          totalContents: records.length,
          model: {
            name: 'xgboost-gbtree-v1',
            targetTransform: 'log1p',
            features: baseFeatureNames(),
            lagDays: MODEL_LAG_DAYS,
            training: {
              minSamples: MIN_TRAIN_SAMPLES,
              ...XGB_PARAMS,
            },
          },
          metrics: {
            mae:
              validMae.length > 0
                ? Number(
                    (
                      validMae.reduce((acc, x) => acc + x, 0) / validMae.length
                    ).toFixed(4),
                  )
                : null,
            mape:
              validMape.length > 0
                ? Number(
                    (
                      validMape.reduce((acc, x) => acc + x, 0) /
                      validMape.length
                    ).toFixed(4),
                  )
                : null,
          },
          records,
        },
        null,
        2,
      ),
      'utf8',
    );

    writeFileSync(
      modelPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          lookbackDays: LOOKBACK_DAYS,
          horizonDays: HORIZON_DAYS,
          modelName: 'xgboost-gbtree-v1',
          features: baseFeatureNames(),
          records: trainedModels,
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`ML forecast generated successfully at ${outputPath}`);
    console.log(`ML model artifacts saved at ${modelPath}`);
    console.log(`Forecast records: ${records.length}`);
  } finally {
    await contentClient.end();
    await auditClient.end();
  }
}

run().catch((error) => {
  console.error('Forecast generation failed:', error);
  process.exit(1);
});
