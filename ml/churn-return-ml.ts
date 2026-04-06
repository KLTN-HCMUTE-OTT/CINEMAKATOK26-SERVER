import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { Client } from 'pg';

type UserInfo = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  createdAt: string;
};

type FeatureRow = {
  userId: string;
  accountAgeDays: number;
  daysSinceLastActivity: number;
  watchProgressCount7d: number;
  auditEvents7d: number;
  watchProgressCount30d: number;
  watchedDuration30d: number;
  completedVideos30d: number;
  watchlistAdds30d: number;
  favoriteAdds30d: number;
  reviews30d: number;
  auditEvents30d: number;
};

type TrainingRow = {
  features: number[];
  label: number;
};

type XGBoostModelPayload = {
  name: 'ml-xgboost';
  model: number[];
  options: Record<string, unknown>;
};

type ChurnPrediction = {
  userId: string;
  name: string;
  email: string | null;
  churnProbability: number;
  returnProbability: number;
  riskLevel: 'high' | 'medium' | 'low';
  features: FeatureRow;
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

const FEATURE_WINDOW_DAYS = 30;
const LABEL_WINDOW_DAYS = 14;
const TRAIN_ANCHOR_COUNT = 8;
const TRAIN_ANCHOR_STEP_DAYS = 7;
const MIN_TRAIN_SAMPLES = 50;
const TRAIN_SPLIT_RATIO = 0.8;

const XGB_PARAMS = {
  booster: 'gbtree',
  objective: 'binary:logistic',
  max_depth: 5,
  eta: 0.06,
  min_child_weight: 1,
  subsample: 0.92,
  colsample_bytree: 0.92,
  silent: 1,
  iterations: 320,
};

const FEATURE_NAMES = [
  'accountAgeDays',
  'daysSinceLastActivity',
  'watchProgressCount7d',
  'auditEvents7d',
  'watchProgressCount30d',
  'watchedDuration30d',
  'completedVideos30d',
  'watchlistAdds30d',
  'favoriteAdds30d',
  'reviews30d',
  'auditEvents30d',
] as const;

const requiredEnv = [
  'USER_DB_HOST',
  'USER_DB_PORT',
  'USER_DB_USERNAME',
  'USER_DB_PASSWORD',
  'USER_DB_NAME',
  'ACTIVITY_DB_HOST',
  'ACTIVITY_DB_PORT',
  'ACTIVITY_DB_USERNAME',
  'ACTIVITY_DB_PASSWORD',
  'ACTIVITY_DB_NAME',
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

function buildClient(prefix: 'USER' | 'ACTIVITY' | 'AUDIT') {
  return new Client({
    host: process.env[`${prefix}_DB_HOST`],
    port: Number(process.env[`${prefix}_DB_PORT`] || 5432),
    user: process.env[`${prefix}_DB_USERNAME`],
    password: process.env[`${prefix}_DB_PASSWORD`],
    database: process.env[`${prefix}_DB_NAME`],
  });
}

function daysAgo(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function toNum(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function getRiskLevel(churnProbability: number): 'high' | 'medium' | 'low' {
  if (churnProbability >= 0.7) {
    return 'high';
  }
  if (churnProbability >= 0.4) {
    return 'medium';
  }
  return 'low';
}

function buildFeatureVector(row: FeatureRow): number[] {
  return FEATURE_NAMES.map((name) => row[name]);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function heuristicChurnProbability(feature: FeatureRow): number {
  const engagement =
    feature.watchProgressCount30d +
    feature.favoriteAdds30d +
    feature.watchlistAdds30d +
    feature.reviews30d +
    feature.auditEvents30d;

  const logit =
    -2.2 +
    0.08 * feature.daysSinceLastActivity +
    0.00002 * feature.watchedDuration30d -
    0.25 * Math.log1p(engagement) -
    0.12 * feature.completedVideos30d;

  return Number(clamp(sigmoid(logit), 0.02, 0.98).toFixed(4));
}

function buildPredictionsFromFeatures(
  featureMap: Map<string, FeatureRow>,
  userInfoMap: Map<string, UserInfo>,
): ChurnPrediction[] {
  const predictions = [...featureMap.entries()].map(([userId, feature]) => {
    const user = userInfoMap.get(userId);
    const churnProbability = heuristicChurnProbability(feature);
    const returnProbability = Number((1 - churnProbability).toFixed(4));

    return {
      userId,
      name: user?.name || 'Unknown',
      email: user?.email || null,
      churnProbability,
      returnProbability,
      riskLevel: getRiskLevel(churnProbability),
      features: feature,
    };
  });

  predictions.sort((a, b) => b.churnProbability - a.churnProbability);
  return predictions;
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function calculateBinaryMetrics(actual: number[], predictedProb: number[]) {
  return calculateBinaryMetricsAtThreshold(actual, predictedProb, 0.5);
}

function calculateBinaryMetricsAtThreshold(
  actual: number[],
  predictedProb: number[],
  threshold: number,
) {
  if (actual.length === 0 || actual.length !== predictedProb.length) {
    return {
      accuracy: null,
      precision: null,
      recall: null,
      f1: null,
      logLoss: null,
    };
  }

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let logLoss = 0;

  for (let i = 0; i < actual.length; i += 1) {
    const y = actual[i];
    const p = Math.max(1e-6, Math.min(1 - 1e-6, predictedProb[i]));
    const predClass = p >= threshold ? 1 : 0;

    if (predClass === 1 && y === 1) tp += 1;
    if (predClass === 1 && y === 0) fp += 1;
    if (predClass === 0 && y === 0) tn += 1;
    if (predClass === 0 && y === 1) fn += 1;

    logLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }

  const accuracy = (tp + tn) / actual.length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

  return {
    accuracy: Number(accuracy.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    logLoss: Number((logLoss / actual.length).toFixed(4)),
  };
}

function findBestThreshold(actual: number[], predictedProb: number[]) {
  if (actual.length === 0 || predictedProb.length === 0) {
    return {
      threshold: 0.5,
      metrics: calculateBinaryMetrics(actual, predictedProb),
    };
  }

  let bestThreshold = 0.5;
  let bestMetrics = calculateBinaryMetricsAtThreshold(
    actual,
    predictedProb,
    0.5,
  );
  let bestF1 = bestMetrics.f1 ?? 0;
  let bestRecall = bestMetrics.recall ?? 0;

  for (let t = 0.2; t <= 0.8; t += 0.02) {
    const threshold = Number(t.toFixed(2));
    const metrics = calculateBinaryMetricsAtThreshold(
      actual,
      predictedProb,
      threshold,
    );
    const f1 = metrics.f1 ?? 0;
    const recall = metrics.recall ?? 0;

    if (f1 > bestF1 || (f1 === bestF1 && recall > bestRecall)) {
      bestThreshold = threshold;
      bestMetrics = metrics;
      bestF1 = f1;
      bestRecall = recall;
    }
  }

  return { threshold: bestThreshold, metrics: bestMetrics };
}

async function getXGBoostCtor(): Promise<XGBoostCtor> {
  if (!xgboostLoader) {
    xgboostLoader = require('ml-xgboost') as Promise<XGBoostCtor>;
  }
  return xgboostLoader;
}

async function collectFeaturesAtAnchor(
  userClient: Client,
  activityClient: Client,
  auditClient: Client,
  anchorDate: Date,
): Promise<Map<string, FeatureRow>> {
  const featureWindowStart = daysAgo(anchorDate, FEATURE_WINDOW_DAYS);

  const usersResult = await userClient.query<UserInfo>(
    `
    SELECT id, name, email, status, "createdAt"::text AS "createdAt"
    FROM "user"
    WHERE "createdAt" <= $1::timestamp
      AND "deletedAt" IS NULL
    `,
    [anchorDate.toISOString()],
  );

  const userIds = usersResult.rows.map((u) => u.id);
  if (userIds.length === 0) {
    return new Map();
  }

  const accountAgeResult = await userClient.query<{
    user_id: string;
    account_age_days: string;
  }>(
    `
    SELECT
      id::text AS user_id,
      GREATEST(0, EXTRACT(EPOCH FROM ($1::timestamp - "createdAt")) / 86400)::int::text AS account_age_days
    FROM "user"
    WHERE id = ANY($2::uuid[])
    `,
    [anchorDate.toISOString(), userIds],
  );

  const watchAggResult = await activityClient.query<{
    user_id: string;
    watch_count_7d: string;
    watch_count: string;
    watched_duration: string;
    completed_count: string;
    last_activity: string | null;
  }>(
    `
    SELECT
      user_id::text AS user_id,
      COALESCE(SUM(CASE WHEN last_watched >= $4::timestamp THEN 1 ELSE 0 END), 0)::int::text AS watch_count_7d,
      COUNT(*)::int::text AS watch_count,
      COALESCE(SUM(watched_duration), 0)::int::text AS watched_duration,
      COALESCE(SUM(CASE WHEN is_completed THEN 1 ELSE 0 END), 0)::int::text AS completed_count,
      MAX(last_watched)::text AS last_activity
    FROM watch_progress
    WHERE last_watched IS NOT NULL
      AND last_watched >= $1::timestamp
      AND last_watched < $2::timestamp
      AND user_id = ANY($3::uuid[])
    GROUP BY user_id
    `,
    [
      featureWindowStart.toISOString(),
      anchorDate.toISOString(),
      userIds,
      daysAgo(anchorDate, 7).toISOString(),
    ],
  );

  const watchlistAggResult = await activityClient.query<{
    user_id: string;
    c: string;
  }>(
    `
    SELECT user_id::text AS user_id, COUNT(*)::int::text AS c
    FROM watchlist
    WHERE "createdAt" >= $1::timestamp
      AND "createdAt" < $2::timestamp
      AND user_id = ANY($3::uuid[])
    GROUP BY user_id
    `,
    [featureWindowStart.toISOString(), anchorDate.toISOString(), userIds],
  );

  const favoriteAggResult = await activityClient.query<{
    user_id: string;
    c: string;
  }>(
    `
    SELECT user_id::text AS user_id, COUNT(*)::int::text AS c
    FROM favorite
    WHERE "createdAt" >= $1::timestamp
      AND "createdAt" < $2::timestamp
      AND user_id = ANY($3::uuid[])
    GROUP BY user_id
    `,
    [featureWindowStart.toISOString(), anchorDate.toISOString(), userIds],
  );

  const reviewAggResult = await activityClient.query<{
    user_id: string;
    c: string;
  }>(
    `
    SELECT user_id::text AS user_id, COUNT(*)::int::text AS c
    FROM review
    WHERE "createdAt" >= $1::timestamp
      AND "createdAt" < $2::timestamp
      AND user_id = ANY($3::uuid[])
    GROUP BY user_id
    `,
    [featureWindowStart.toISOString(), anchorDate.toISOString(), userIds],
  );

  const auditAggResult = await auditClient.query<{
    user_id: string;
    c: string;
    last_activity: string | null;
  }>(
    `
    SELECT
      "userId"::text AS user_id,
      COUNT(*)::int::text AS c,
      MAX("createdAt")::text AS last_activity
    FROM audit_logs
    WHERE "createdAt" >= $1::timestamp
      AND "createdAt" < $2::timestamp
      AND "userId" = ANY($3::text[])
    GROUP BY "userId"
    `,
    [featureWindowStart.toISOString(), anchorDate.toISOString(), userIds],
  );

  const auditAgg7dResult = await auditClient.query<{
    user_id: string;
    c: string;
  }>(
    `
    SELECT
      "userId"::text AS user_id,
      COUNT(*)::int::text AS c
    FROM audit_logs
    WHERE "createdAt" >= $1::timestamp
      AND "createdAt" < $2::timestamp
      AND "userId" = ANY($3::text[])
    GROUP BY "userId"
    `,
    [daysAgo(anchorDate, 7).toISOString(), anchorDate.toISOString(), userIds],
  );

  const base = new Map<string, FeatureRow>();
  for (const user of usersResult.rows) {
    base.set(user.id, {
      userId: user.id,
      accountAgeDays: 0,
      daysSinceLastActivity: FEATURE_WINDOW_DAYS + 1,
      watchProgressCount7d: 0,
      auditEvents7d: 0,
      watchProgressCount30d: 0,
      watchedDuration30d: 0,
      completedVideos30d: 0,
      watchlistAdds30d: 0,
      favoriteAdds30d: 0,
      reviews30d: 0,
      auditEvents30d: 0,
    });
  }

  for (const row of accountAgeResult.rows) {
    const item = base.get(row.user_id);
    if (item) {
      item.accountAgeDays = toNum(row.account_age_days);
    }
  }

  const lastActivityMap = new Map<string, Date>();

  for (const row of watchAggResult.rows) {
    const item = base.get(row.user_id);
    if (!item) continue;
    item.watchProgressCount7d = toNum(row.watch_count_7d);
    item.watchProgressCount30d = toNum(row.watch_count);
    item.watchedDuration30d = toNum(row.watched_duration);
    item.completedVideos30d = toNum(row.completed_count);
    if (row.last_activity) {
      lastActivityMap.set(row.user_id, new Date(row.last_activity));
    }
  }

  for (const row of watchlistAggResult.rows) {
    const item = base.get(row.user_id);
    if (item) item.watchlistAdds30d = toNum(row.c);
  }

  for (const row of favoriteAggResult.rows) {
    const item = base.get(row.user_id);
    if (item) item.favoriteAdds30d = toNum(row.c);
  }

  for (const row of reviewAggResult.rows) {
    const item = base.get(row.user_id);
    if (item) item.reviews30d = toNum(row.c);
  }

  for (const row of auditAggResult.rows) {
    const item = base.get(row.user_id);
    if (!item) continue;
    item.auditEvents30d = toNum(row.c);
    if (row.last_activity) {
      const current = lastActivityMap.get(row.user_id);
      const candidate = new Date(row.last_activity);
      if (!current || candidate > current) {
        lastActivityMap.set(row.user_id, candidate);
      }
    }
  }

  for (const row of auditAgg7dResult.rows) {
    const item = base.get(row.user_id);
    if (item) {
      item.auditEvents7d = toNum(row.c);
    }
  }

  for (const [userId, row] of base.entries()) {
    const lastActivity = lastActivityMap.get(userId);
    if (!lastActivity) {
      row.daysSinceLastActivity = FEATURE_WINDOW_DAYS + 1;
      continue;
    }

    const diff = Math.max(
      0,
      Math.floor(
        (anchorDate.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000),
      ),
    );
    row.daysSinceLastActivity = diff;
  }

  return base;
}

async function collectChurnLabelsAtAnchor(
  activityClient: Client,
  auditClient: Client,
  userIds: string[],
  anchorDate: Date,
): Promise<Map<string, number>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const labelWindowEnd = daysAgo(anchorDate, -LABEL_WINDOW_DAYS);

  const futureWatchResult = await activityClient.query<{
    user_id: string;
    c: string;
  }>(
    `
    SELECT user_id::text AS user_id, COUNT(*)::int::text AS c
    FROM watch_progress
    WHERE last_watched IS NOT NULL
      AND last_watched >= $1::timestamp
      AND last_watched < $2::timestamp
      AND user_id = ANY($3::uuid[])
    GROUP BY user_id
    `,
    [anchorDate.toISOString(), labelWindowEnd.toISOString(), userIds],
  );

  const futureAuditResult = await auditClient.query<{
    user_id: string;
    c: string;
  }>(
    `
    SELECT "userId"::text AS user_id, COUNT(*)::int::text AS c
    FROM audit_logs
    WHERE "createdAt" >= $1::timestamp
      AND "createdAt" < $2::timestamp
      AND "userId" = ANY($3::text[])
    GROUP BY "userId"
    `,
    [anchorDate.toISOString(), labelWindowEnd.toISOString(), userIds],
  );

  const futureActivityMap = new Map<string, number>();

  for (const row of futureWatchResult.rows) {
    futureActivityMap.set(row.user_id, toNum(row.c));
  }

  for (const row of futureAuditResult.rows) {
    const existing = futureActivityMap.get(row.user_id) || 0;
    futureActivityMap.set(row.user_id, existing + toNum(row.c));
  }

  const labels = new Map<string, number>();
  for (const userId of userIds) {
    const hasFutureActivity = (futureActivityMap.get(userId) || 0) > 0;
    labels.set(userId, hasFutureActivity ? 0 : 1);
  }

  return labels;
}

async function buildTrainingRows(
  userClient: Client,
  activityClient: Client,
  auditClient: Client,
  now: Date,
): Promise<TrainingRow[]> {
  const rows: TrainingRow[] = [];

  for (let i = TRAIN_ANCHOR_COUNT - 1; i >= 0; i -= 1) {
    const anchorOffset = LABEL_WINDOW_DAYS + i * TRAIN_ANCHOR_STEP_DAYS;
    const anchorDate = daysAgo(now, anchorOffset);

    const featureMap = await collectFeaturesAtAnchor(
      userClient,
      activityClient,
      auditClient,
      anchorDate,
    );

    const userIds = [...featureMap.keys()];
    const labels = await collectChurnLabelsAtAnchor(
      activityClient,
      auditClient,
      userIds,
      anchorDate,
    );

    for (const userId of userIds) {
      const feature = featureMap.get(userId)!;
      const label = labels.get(userId);
      if (label === undefined) {
        continue;
      }

      rows.push({
        features: buildFeatureVector(feature),
        label,
      });
    }
  }

  return rows;
}

async function run() {
  loadEnvFile(resolve('.env'));
  loadEnvFile(resolve('apps/user-service/.env'));
  loadEnvFile(resolve('apps/user-activity-service/.env'));
  loadEnvFile(resolve('apps/audit-log-service/.env'));
  ensureRequiredEnv();

  const userClient = buildClient('USER');
  const activityClient = buildClient('ACTIVITY');
  const auditClient = buildClient('AUDIT');

  await userClient.connect();
  await activityClient.connect();
  await auditClient.connect();

  try {
    const now = new Date();
    const trainingRows = await buildTrainingRows(
      userClient,
      activityClient,
      auditClient,
      now,
    );

    const currentFeatureMap = await collectFeaturesAtAnchor(
      userClient,
      activityClient,
      auditClient,
      now,
    );
    const currentUserIds = [...currentFeatureMap.keys()];

    const outputDir = resolve('exports/analytics');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, 'user-churn-prediction.json');

    if (currentUserIds.length === 0) {
      writeFileSync(
        outputPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            model: {
              name: 'cold-start-no-users',
              objective: 'binary:logistic',
              featureWindowDays: FEATURE_WINDOW_DAYS,
              labelWindowDays: LABEL_WINDOW_DAYS,
              trainAnchorCount: TRAIN_ANCHOR_COUNT,
              trainAnchorStepDays: TRAIN_ANCHOR_STEP_DAYS,
              features: FEATURE_NAMES,
              params: XGB_PARAMS,
            },
            data: {
              totalTrainingSamples: trainingRows.length,
              trainSamples: 0,
              testSamples: 0,
              churnRateTrain: null,
              churnRateTest: null,
            },
            metrics: {
              accuracy: null,
              precision: null,
              recall: null,
              f1: null,
              logLoss: null,
            },
            summary: {
              totalUsersScored: 0,
              highRiskUsers: 0,
              mediumRiskUsers: 0,
              lowRiskUsers: 0,
            },
            topRiskUsers: [],
            predictions: [],
            modelArtifact: null,
            warning: 'No users found to score.',
          },
          null,
          2,
        ),
        'utf8',
      );
      console.log(`Churn prediction generated successfully at ${outputPath}`);
      console.log('No users found to score.');
      return;
    }

    const userInfoResult = await userClient.query<UserInfo>(
      `
      SELECT id, name, email, status, "createdAt"::text AS "createdAt"
      FROM "user"
      WHERE id = ANY($1::uuid[])
      `,
      [currentUserIds],
    );
    const userInfoMap = new Map<string, UserInfo>(
      userInfoResult.rows.map((u) => [u.id, u]),
    );

    if (trainingRows.length < MIN_TRAIN_SAMPLES) {
      const predictions = buildPredictionsFromFeatures(
        currentFeatureMap,
        userInfoMap,
      );

      writeFileSync(
        outputPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            model: {
              name: 'heuristic-user-churn-cold-start-v1',
              objective: 'binary:logistic',
              featureWindowDays: FEATURE_WINDOW_DAYS,
              labelWindowDays: LABEL_WINDOW_DAYS,
              trainAnchorCount: TRAIN_ANCHOR_COUNT,
              trainAnchorStepDays: TRAIN_ANCHOR_STEP_DAYS,
              features: FEATURE_NAMES,
              params: XGB_PARAMS,
            },
            data: {
              totalTrainingSamples: trainingRows.length,
              trainSamples: 0,
              testSamples: 0,
              churnRateTrain: null,
              churnRateTest: null,
            },
            metrics: {
              accuracy: null,
              precision: null,
              recall: null,
              f1: null,
              logLoss: null,
            },
            summary: {
              totalUsersScored: predictions.length,
              highRiskUsers: predictions.filter((x) => x.riskLevel === 'high')
                .length,
              mediumRiskUsers: predictions.filter(
                (x) => x.riskLevel === 'medium',
              ).length,
              lowRiskUsers: predictions.filter((x) => x.riskLevel === 'low')
                .length,
            },
            topRiskUsers: predictions.slice(0, 200),
            predictions,
            modelArtifact: null,
            warning: `Not enough training samples for XGBoost (required >= ${MIN_TRAIN_SAMPLES}, got ${trainingRows.length}). Returned heuristic cold-start predictions.`,
          },
          null,
          2,
        ),
        'utf8',
      );

      console.log(`Churn prediction generated successfully at ${outputPath}`);
      console.log(
        `Cold-start mode: insufficient training samples (${trainingRows.length}).`,
      );
      return;
    }

    shuffleInPlace(trainingRows);

    const splitIndex = Math.max(
      1,
      Math.floor(trainingRows.length * TRAIN_SPLIT_RATIO),
    );
    const trainRows = trainingRows.slice(0, splitIndex);
    const testRows = trainingRows.slice(splitIndex);

    const XTrain = trainRows.map((r) => r.features);
    const yTrain = trainRows.map((r) => r.label);

    const XTest = testRows.map((r) => r.features);
    const yTest = testRows.map((r) => r.label);

    const XGBoost = await getXGBoostCtor();
    const positive = yTrain.filter((x) => x === 1).length;
    const negative = yTrain.length - positive;
    const scalePosWeight =
      positive > 0 ? Number((negative / positive).toFixed(4)) : 1;
    const booster = new XGBoost({
      ...XGB_PARAMS,
      scale_pos_weight: scalePosWeight,
    });

    try {
      booster.train(XTrain, yTrain);

      const testPred =
        XTest.length > 0
          ? booster
              .predict(XTest)
              .map((x) => Math.max(0, Math.min(1, Number(x))))
          : [];
      const tuned = findBestThreshold(yTest, testPred);
      const testMetrics = tuned.metrics;

      const predictRows = currentUserIds.map((userId) => {
        const feature = currentFeatureMap.get(userId)!;
        return {
          userId,
          feature,
          vector: buildFeatureVector(feature),
        };
      });

      const predicted =
        predictRows.length > 0
          ? booster
              .predict(predictRows.map((row) => row.vector))
              .map((x) => Math.max(0, Math.min(1, Number(x))))
          : [];

      const predictions: ChurnPrediction[] = predictRows.map((row, idx) => {
        const user = userInfoMap.get(row.userId);
        const rawProb = Number((predicted[idx] || 0).toFixed(4));
        const churnProbability = Number(rawProb.toFixed(4));
        const returnProbability = Number((1 - churnProbability).toFixed(4));

        return {
          userId: row.userId,
          name: user?.name || 'Unknown',
          email: user?.email || null,
          churnProbability,
          returnProbability,
          riskLevel: getRiskLevel(churnProbability),
          features: row.feature,
        };
      });

      predictions.sort((a, b) => b.churnProbability - a.churnProbability);

      const modelArtifact = booster.toJSON();
      writeFileSync(
        outputPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            model: {
              name: 'xgboost-user-churn-v1',
              objective: 'binary:logistic',
              classificationThreshold: tuned.threshold,
              featureWindowDays: FEATURE_WINDOW_DAYS,
              labelWindowDays: LABEL_WINDOW_DAYS,
              trainAnchorCount: TRAIN_ANCHOR_COUNT,
              trainAnchorStepDays: TRAIN_ANCHOR_STEP_DAYS,
              features: FEATURE_NAMES,
              params: {
                ...XGB_PARAMS,
                scale_pos_weight: scalePosWeight,
              },
            },
            data: {
              totalTrainingSamples: trainingRows.length,
              trainSamples: trainRows.length,
              testSamples: testRows.length,
              churnRateTrain: Number(
                (
                  yTrain.reduce((acc, x) => acc + x, 0) /
                  Math.max(1, yTrain.length)
                ).toFixed(4),
              ),
              churnRateTest:
                yTest.length > 0
                  ? Number(
                      (
                        yTest.reduce((acc, x) => acc + x, 0) / yTest.length
                      ).toFixed(4),
                    )
                  : null,
            },
            metrics: testMetrics,
            summary: {
              totalUsersScored: predictions.length,
              highRiskUsers: predictions.filter((x) => x.riskLevel === 'high')
                .length,
              mediumRiskUsers: predictions.filter(
                (x) => x.riskLevel === 'medium',
              ).length,
              lowRiskUsers: predictions.filter((x) => x.riskLevel === 'low')
                .length,
            },
            topRiskUsers: predictions.slice(0, 200),
            predictions,
            modelArtifact,
          },
          null,
          2,
        ),
        'utf8',
      );

      console.log(`Churn prediction generated successfully at ${outputPath}`);
      console.log(`Scored users: ${predictions.length}`);
      console.log(`Test metrics: ${JSON.stringify(testMetrics)}`);
    } finally {
      booster.free();
    }
  } finally {
    await userClient.end();
    await activityClient.end();
    await auditClient.end();
  }
}

run().catch((error) => {
  console.error('Churn prediction generation failed:', error);
  process.exit(1);
});
