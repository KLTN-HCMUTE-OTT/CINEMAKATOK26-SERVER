import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as bcrypt from 'bcryptjs';

import { Client } from 'pg';

const USER_COUNT = 36;
const REQUIRED_ENV = [
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

type SeedUser = {
  id: string;
  name: string;
  email: string;
  cohort: 'engaged' | 'at-risk' | 'churned';
};

type WatchProgressRow = {
  id: string;
  userId: string;
  videoId: string;
  lastWatched: Date;
  watchedDuration: number;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type WatchlistRow = {
  id: string;
  userId: string;
  contentId: string;
  createdAt: Date;
  updatedAt: Date;
};

type FavoriteRow = {
  id: string;
  userId: string;
  contentId: string;
  createdAt: Date;
  updatedAt: Date;
};

type ReviewRow = {
  id: string;
  userId: string;
  contentId: string;
  contentReviewed: string;
  rating: number;
  status: 'ACTIVE';
  createdAt: Date;
  updatedAt: Date;
};

type AuditRow = {
  id: string;
  userId: string;
  sessionId: string;
  action: 'USER_LOGIN' | 'PLAY_MOVIE' | 'CONTENT_VIEW_INCREASED';
  signalWeight: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

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
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBool(trueChance = 0.5): boolean {
  return Math.random() < trueChance;
}

function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function randomDateWithinDay(dayAgoValue: number): Date {
  const date = daysAgo(dayAgoValue);
  date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59), 0);
  return date;
}

function pickCohort(index: number): SeedUser['cohort'] {
  if (index < USER_COUNT / 3) {
    return 'engaged';
  }
  if (index < (2 * USER_COUNT) / 3) {
    return 'at-risk';
  }
  return 'churned';
}

async function seedUsers(userClient: Client): Promise<SeedUser[]> {
  const runKey = Date.now();
  const users: SeedUser[] = [];

  for (let i = 0; i < USER_COUNT; i += 1) {
    const cohort = pickCohort(i);
    users.push({
      id: randomUUID(),
      name: `Seed Churn User ${i + 1}`,
      email: `seed-churn-${runKey}-${i + 1}@example.com`,
      cohort,
    });
  }

  for (const user of users) {
    const accountAgeDays =
      user.cohort === 'engaged'
        ? randomInt(60, 120)
        : user.cohort === 'at-risk'
          ? randomInt(45, 100)
          : randomInt(70, 150);

    const createdAt = randomDateWithinDay(accountAgeDays);

    const hashedPassword = bcrypt.hashSync('seed-password', 10);

    await userClient.query(
      `
      INSERT INTO "user" (
        id,
        name,
        email,
        password,
        status,
        "isAdmin",
        "isEmailVerified",
        "isBanned",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 'ACTIVATED', false, true, false, $5, $6)
      `,
      [user.id, user.name, user.email, hashedPassword, createdAt, createdAt],
    );
  }

  return users;
}

function generateActivityRows(users: SeedUser[]) {
  const watchProgressRows: WatchProgressRow[] = [];
  const watchlistRows: WatchlistRow[] = [];
  const favoriteRows: FavoriteRow[] = [];
  const reviewRows: ReviewRow[] = [];
  const auditRows: AuditRow[] = [];

  for (const user of users) {
    for (let day = 0; day <= 84; day += 1) {
      const activityDate = randomDateWithinDay(day);

      let shouldActive = false;
      if (user.cohort === 'engaged') {
        shouldActive = randomBool(0.8);
      } else if (user.cohort === 'at-risk') {
        shouldActive = day > 21 ? randomBool(0.7) : randomBool(0.18);
      } else {
        shouldActive = day > 45 ? randomBool(0.72) : randomBool(0.06);
      }

      if (!shouldActive) {
        continue;
      }

      const watchCount =
        user.cohort === 'engaged'
          ? randomInt(1, 4)
          : user.cohort === 'at-risk'
            ? randomInt(1, 3)
            : randomInt(1, 2);

      for (let i = 0; i < watchCount; i += 1) {
        const lastWatched = new Date(activityDate.getTime() + i * 60 * 1000);
        watchProgressRows.push({
          id: randomUUID(),
          userId: user.id,
          videoId: randomUUID(),
          lastWatched,
          watchedDuration: randomInt(120, 3600),
          isCompleted: randomBool(0.35),
          createdAt: lastWatched,
          updatedAt: lastWatched,
        });
      }

      if (randomBool(0.32)) {
        watchlistRows.push({
          id: randomUUID(),
          userId: user.id,
          contentId: randomUUID(),
          createdAt: activityDate,
          updatedAt: activityDate,
        });
      }

      if (randomBool(0.24)) {
        favoriteRows.push({
          id: randomUUID(),
          userId: user.id,
          contentId: randomUUID(),
          createdAt: activityDate,
          updatedAt: activityDate,
        });
      }

      if (randomBool(0.14)) {
        reviewRows.push({
          id: randomUUID(),
          userId: user.id,
          contentId: randomUUID(),
          contentReviewed: `Seed review for churn dataset on day-${day}`,
          rating: randomInt(3, 5),
          status: 'ACTIVE',
          createdAt: activityDate,
          updatedAt: activityDate,
        });
      }

      const auditEventCount = randomInt(1, 3);
      for (let i = 0; i < auditEventCount; i += 1) {
        const eventAt = new Date(activityDate.getTime() + i * 120 * 1000);
        const action =
          i % 3 === 0
            ? 'USER_LOGIN'
            : i % 3 === 1
              ? 'PLAY_MOVIE'
              : 'CONTENT_VIEW_INCREASED';

        auditRows.push({
          id: randomUUID(),
          userId: user.id,
          sessionId: randomUUID(),
          action,
          signalWeight: action === 'CONTENT_VIEW_INCREASED' ? 2 : 1,
          metadata: {
            source: 'seed-churn-return',
            cohort: user.cohort,
            synthetic: true,
          },
          createdAt: eventAt,
          updatedAt: eventAt,
        });
      }
    }
  }

  return {
    watchProgressRows,
    watchlistRows,
    favoriteRows,
    reviewRows,
    auditRows,
  };
}

async function insertActivityRows(
  activityClient: Client,
  rows: ReturnType<typeof generateActivityRows>,
) {
  for (const row of rows.watchProgressRows) {
    await activityClient.query(
      `
      INSERT INTO watch_progress (
        id,
        user_id,
        video_id,
        last_watched,
        watched_duration,
        is_completed,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        row.id,
        row.userId,
        row.videoId,
        row.lastWatched,
        row.watchedDuration,
        row.isCompleted,
        row.createdAt,
        row.updatedAt,
      ],
    );
  }

  for (const row of rows.watchlistRows) {
    await activityClient.query(
      `
      INSERT INTO watchlist (
        id,
        user_id,
        content_id,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5)
      `,
      [row.id, row.userId, row.contentId, row.createdAt, row.updatedAt],
    );
  }

  for (const row of rows.favoriteRows) {
    await activityClient.query(
      `
      INSERT INTO favorite (
        id,
        user_id,
        content_id,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5)
      `,
      [row.id, row.userId, row.contentId, row.createdAt, row.updatedAt],
    );
  }

  for (const row of rows.reviewRows) {
    await activityClient.query(
      `
      INSERT INTO review (
        id,
        "contentReviewed",
        rating,
        status,
        user_id,
        content_id,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        row.id,
        row.contentReviewed,
        row.rating,
        row.status,
        row.userId,
        row.contentId,
        row.createdAt,
        row.updatedAt,
      ],
    );
  }
}

async function insertAuditRows(auditClient: Client, rows: AuditRow[]) {
  for (const row of rows) {
    await auditClient.query(
      `
      INSERT INTO audit_logs (
        id,
        "userId",
        "sessionId",
        action,
        "resourceType",
        "resourceId",
        "signalWeight",
        metadata,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6::jsonb, $7, $8)
      `,
      [
        row.id,
        row.userId,
        row.sessionId,
        row.action,
        row.signalWeight,
        JSON.stringify(row.metadata),
        row.createdAt,
        row.updatedAt,
      ],
    );
  }
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
    const users = await seedUsers(userClient);
    const generated = generateActivityRows(users);

    await insertActivityRows(activityClient, generated);
    await insertAuditRows(auditClient, generated.auditRows);

    console.log('Seed churn-return completed');
    console.log(`- Seeded users: ${users.length}`);
    console.log(
      `- Seeded watch_progress rows: ${generated.watchProgressRows.length}`,
    );
    console.log(`- Seeded watchlist rows: ${generated.watchlistRows.length}`);
    console.log(`- Seeded favorite rows: ${generated.favoriteRows.length}`);
    console.log(`- Seeded review rows: ${generated.reviewRows.length}`);
    console.log(`- Seeded audit_logs rows: ${generated.auditRows.length}`);
    console.log('Run: pnpm ml:predict:churn');
  } finally {
    await userClient.end();
    await activityClient.end();
    await auditClient.end();
  }
}

run().catch((error) => {
  console.error('Seed churn-return failed:', error);
  process.exit(1);
});
