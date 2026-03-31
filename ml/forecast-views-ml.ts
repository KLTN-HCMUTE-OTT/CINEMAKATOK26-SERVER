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

const LOOKBACK_DAYS = 30;
const HORIZON_DAYS = 7;
const ROLLING_BACKTEST_WINDOWS = 3;

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

function exponentialSmoothing(values: number[], alpha = 0.35): number {
  if (values.length === 0) {
    return 0;
  }

  let smoothed = values[0];
  for (let i = 1; i < values.length; i += 1) {
    smoothed = alpha * values[i] + (1 - alpha) * smoothed;
  }
  return smoothed;
}

function linearTrend(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n <= 1) {
    return { slope: 0, intercept: values[0] || 0 };
  }

  const xs = values.map((_, idx) => idx + 1);
  const ys = values;

  const sumX = xs.reduce((acc, x) => acc + x, 0);
  const sumY = ys.reduce((acc, y) => acc + y, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope: denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator,
    intercept:
      (sumY -
        (denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator) *
          sumX) /
      n,
  };
}

function weekdaySeasonalityFactors(values: number[]): number[] {
  const factors = Array.from({ length: 7 }, () => 1);
  if (values.length < 14) {
    return factors;
  }

  const sums = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);
  for (let i = 0; i < values.length; i += 1) {
    const weekday = i % 7;
    sums[weekday] += values[i];
    counts[weekday] += 1;
  }

  const globalAvg = values.reduce((acc, x) => acc + x, 0) / values.length;
  if (globalAvg <= 0) {
    return factors;
  }

  for (let i = 0; i < 7; i += 1) {
    const weekdayAvg = counts[i] > 0 ? sums[i] / counts[i] : globalAvg;
    factors[i] = Math.max(0.6, Math.min(1.5, weekdayAvg / globalAvg));
  }

  return factors;
}

function blendedForecast(values: number[], horizon: number): number[] {
  if (values.length === 0) {
    return Array.from({ length: horizon }, () => 0);
  }

  if (values.length < 10) {
    const avg = Math.round(movingAverage(values, Math.min(7, values.length)));
    return Array.from({ length: horizon }, () => Math.max(0, avg));
  }

  const trend = linearTrend(values);
  const ewma = exponentialSmoothing(values, 0.35);
  const ma7 = movingAverage(values, 7);
  const seasonality = weekdaySeasonalityFactors(values);

  const forecast: number[] = [];
  for (let i = 1; i <= horizon; i += 1) {
    const x = values.length + i;
    const trendValue = trend.intercept + trend.slope * x;
    const seasonalFactor = seasonality[(x - 1) % 7];
    const blended =
      (0.5 * trendValue + 0.3 * ewma + 0.2 * ma7) * seasonalFactor;
    forecast.push(Math.max(0, Math.round(blended)));
  }

  return forecast;
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
  const MAPE_MIN_THRESHOLD = 5; // Only count MAPE for values >= 5 to avoid noise from tiny values

  for (let i = 0; i < actual.length; i += 1) {
    const a = actual[i];
    const p = predicted[i];
    absErrorSum += Math.abs(a - p);
    // Only count % error for meaningful values (>= threshold) to avoid huge % errors on tiny counts
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

function rollingBacktest(
  values: number[],
  horizon: number,
  windows: number,
): {
  mae: number | null;
  mape: number | null;
} {
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
    const predicted = blendedForecast(train, horizon);
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

  // Heuristic confidence based on forecasting error.
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
      const next7DaysViews = blendedForecast(values, HORIZON_DAYS);
      const totalForecast7d = next7DaysViews.reduce((acc, x) => acc + x, 0);
      const predictedTrend = buildTrend(last7Avg, next7DaysViews);

      const rollingEval = rollingBacktest(
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
            name: 'blended-trend-seasonal-v2',
            components: ['linear-trend', 'ewma', 'ma7', 'weekday-seasonality'],
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

    console.log(`ML forecast generated successfully at ${outputPath}`);
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
