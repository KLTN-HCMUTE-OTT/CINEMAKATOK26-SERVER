import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { DataSource, DataSourceOptions } from 'typeorm';

import { MaturityRating } from '@app/common/enums/global.enum';
import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';

import { AuditLog } from '../apps/audit-log-service/src/entities/audit-log.entity';
import {
  EntityActor,
  EntityDirector,
} from '../apps/content-service/src/entities/actor.entity';
import { EntityCategory } from '../apps/content-service/src/entities/category.entity';
import {
  ContentType,
  EntityContent,
} from '../apps/content-service/src/entities/content.entity';
import { EntityMovie } from '../apps/content-service/src/entities/movie.entity';
import { EntityTag } from '../apps/content-service/src/entities/tag.entity';
import {
  EntityEpisode,
  EntitySeason,
  EntityTVSeries,
} from '../apps/content-service/src/entities/tvseries.entity';

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

loadEnvFile(resolve('.env'));
loadEnvFile(resolve('apps/content-service/.env'));
loadEnvFile(resolve('apps/audit-log-service/.env'));

type SeedContent = {
  id: string;
  title: string;
  type: RESOURCE_TYPE;
};

type AuditLogSeed = Partial<
  Pick<
    AuditLog,
    | 'userId'
    | 'sessionId'
    | 'action'
    | 'resourceType'
    | 'resourceId'
    | 'signalWeight'
    | 'metadata'
    | 'createdAt'
  >
>;

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

function ensureRequiredEnv() {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function buildDataSource(
  prefix: 'CONTENT' | 'AUDIT',
  entities: DataSourceOptions['entities'],
) {
  return new DataSource({
    type: 'postgres',
    host: process.env[`${prefix}_DB_HOST`],
    port: Number(process.env[`${prefix}_DB_PORT`] || 5432),
    username: process.env[`${prefix}_DB_USERNAME`],
    password: process.env[`${prefix}_DB_PASSWORD`],
    database: process.env[`${prefix}_DB_NAME`],
    synchronize: false,
    entities,
    logging: false,
  });
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function buildPastDate(daysAgo: number): Date {
  const now = new Date();
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59), 0);
  return date;
}

async function seedContent(contentDs: DataSource): Promise<SeedContent[]> {
  const categoryRepo = contentDs.getRepository(EntityCategory);
  const movieRepo = contentDs.getRepository(EntityMovie);
  const tvRepo = contentDs.getRepository(EntityTVSeries);

  await contentDs.query(`
    TRUNCATE TABLE
      "content_category",
      "season",
      "episode",
      "tvseries",
      "movies",
      "content",
      "category"
    CASCADE;
  `);

  const categories = await categoryRepo.save([
    { categoryName: 'Action' },
    { categoryName: 'Drama' },
    { categoryName: 'Sci-Fi' },
    { categoryName: 'Comedy' },
  ]);

  const movieSeeds = [
    {
      title: 'Edge of Tomorrow',
      viewCount: 3600,
      categoryIndexes: [0, 2],
      rating: 8.4,
      imdb: 8.0,
      releaseDate: new Date('2024-05-10'),
    },
    {
      title: 'The Silent City',
      viewCount: 2100,
      categoryIndexes: [1],
      rating: 7.6,
      imdb: 7.2,
      releaseDate: new Date('2023-11-04'),
    },
    {
      title: 'Fast Arena',
      viewCount: 4800,
      categoryIndexes: [0],
      rating: 8.1,
      imdb: 7.8,
      releaseDate: new Date('2025-01-20'),
    },
  ];

  const tvSeeds = [
    {
      title: 'Galaxy Patrol',
      viewCount: 5100,
      categoryIndexes: [2],
      rating: 8.7,
      imdb: 8.3,
      releaseDate: new Date('2024-08-19'),
    },
    {
      title: 'Laugh District',
      viewCount: 1700,
      categoryIndexes: [3],
      rating: 7.1,
      imdb: 6.9,
      releaseDate: new Date('2022-02-01'),
    },
  ];

  const seededContents: SeedContent[] = [];

  for (const seed of movieSeeds) {
    const movie = movieRepo.create({
      duration: randomInt(95, 145),
      metaData: {
        type: ContentType.MOVIE,
        title: seed.title,
        description: `${seed.title} generated for analytics testing`,
        releaseDate: seed.releaseDate,
        thumbnail: `https://example.com/posters/${seed.title.toLowerCase().replace(/\s+/g, '-')}.jpg`,
        banner: `https://example.com/banners/${seed.title.toLowerCase().replace(/\s+/g, '-')}.jpg`,
        trailer: `https://example.com/trailers/${seed.title.toLowerCase().replace(/\s+/g, '-')}.mp4`,
        avgRating: seed.rating,
        maturityRating: MaturityRating.PG13,
        imdbRating: seed.imdb,
        viewCount: seed.viewCount,
        categories: seed.categoryIndexes.map((i) => categories[i]),
      } as EntityContent,
    });

    const saved = await movieRepo.save(movie);
    seededContents.push({
      id: saved.metaData.id,
      title: saved.metaData.title,
      type: RESOURCE_TYPE.MOVIE,
    });
  }

  for (const seed of tvSeeds) {
    const tv = tvRepo.create({
      metaData: {
        type: ContentType.TVSERIES,
        title: seed.title,
        description: `${seed.title} generated for analytics testing`,
        releaseDate: seed.releaseDate,
        thumbnail: `https://example.com/posters/${seed.title.toLowerCase().replace(/\s+/g, '-')}.jpg`,
        banner: `https://example.com/banners/${seed.title.toLowerCase().replace(/\s+/g, '-')}.jpg`,
        trailer: `https://example.com/trailers/${seed.title.toLowerCase().replace(/\s+/g, '-')}.mp4`,
        avgRating: seed.rating,
        maturityRating: MaturityRating.PG13,
        imdbRating: seed.imdb,
        viewCount: seed.viewCount,
        categories: seed.categoryIndexes.map((i) => categories[i]),
      } as EntityContent,
      seasons: [],
    });

    const saved = await tvRepo.save(tv);
    seededContents.push({
      id: saved.metaData.id,
      title: saved.metaData.title,
      type: RESOURCE_TYPE.SERIES,
    });
  }

  return seededContents;
}

function buildAuditLogs(contents: SeedContent[]): AuditLogSeed[] {
  const logs: AuditLogSeed[] = [];
  const users = Array.from({ length: 12 }, () => randomUUID());

  const recentBoostContent = contents[0];
  const stableContent = contents[1];
  const downTrendContent = contents[2];

  for (const userId of users) {
    logs.push({
      userId,
      sessionId: randomUUID(),
      action: LOG_ACTION.USER_LOGIN,
      signalWeight: 0,
      metadata: { source: 'seed-analytics' },
      createdAt: buildPastDate(randomInt(0, 5)),
    });
  }

  for (const userId of users.slice(0, 5)) {
    logs.push({
      userId,
      sessionId: randomUUID(),
      action: LOG_ACTION.USER_REGISTRATION,
      signalWeight: 0,
      metadata: { source: 'seed-analytics' },
      createdAt: buildPastDate(randomInt(1, 20)),
    });
  }

  const pushViews = (
    content: SeedContent,
    count: number,
    minDays: number,
    maxDays: number,
  ) => {
    for (let i = 0; i < count; i += 1) {
      const userId = pickOne(users);
      logs.push({
        userId,
        sessionId: randomUUID(),
        action: LOG_ACTION.CONTENT_VIEW_INCREASED,
        resourceType: content.type,
        resourceId: content.id,
        signalWeight: 2,
        metadata: { contentId: content.id, title: content.title },
        createdAt: buildPastDate(randomInt(minDays, maxDays)),
      });
    }
  };

  pushViews(recentBoostContent, 90, 0, 6);
  pushViews(recentBoostContent, 20, 7, 13);

  pushViews(stableContent, 35, 0, 6);
  pushViews(stableContent, 34, 7, 13);

  pushViews(downTrendContent, 18, 0, 6);
  pushViews(downTrendContent, 60, 7, 13);

  const engagementActions = [
    LOG_ACTION.LIKE_MOVIE,
    LOG_ACTION.ADD_MOVIE_TO_WATCHLIST,
    LOG_ACTION.PLAY_MOVIE,
    LOG_ACTION.LIKE_SERIES,
    LOG_ACTION.ADD_SERIES_TO_WATCHLIST,
    LOG_ACTION.PLAY_EPISODE_OF_SERIES,
    LOG_ACTION.CREATE_REVIEW,
  ];

  for (let i = 0; i < 180; i += 1) {
    const content = pickOne(contents);
    const userId = pickOne(users);
    logs.push({
      userId,
      sessionId: randomUUID(),
      action: pickOne(engagementActions),
      resourceType: content.type,
      resourceId: content.id,
      signalWeight: 1,
      metadata: { contentId: content.id, title: content.title },
      createdAt: buildPastDate(randomInt(0, 20)),
    });
  }

  for (const userId of users.slice(8)) {
    logs.push({
      userId,
      sessionId: randomUUID(),
      action: LOG_ACTION.USER_LOGIN,
      signalWeight: 0,
      metadata: { source: 'seed-analytics' },
      createdAt: buildPastDate(randomInt(31, 60)),
    });
  }

  return logs;
}

async function seedAudit(auditDs: DataSource, contents: SeedContent[]) {
  const repo = auditDs.getRepository(AuditLog);

  await auditDs.query('TRUNCATE TABLE "audit_logs" CASCADE;');

  const logs = buildAuditLogs(contents);
  await repo.save(repo.create(logs));

  return logs.length;
}

async function run() {
  ensureRequiredEnv();

  const contentDs = buildDataSource('CONTENT', [
    EntityActor,
    EntityDirector,
    EntityCategory,
    EntityContent,
    EntityEpisode,
    EntityMovie,
    EntitySeason,
    EntityTag,
    EntityTVSeries,
  ]);

  const auditDs = buildDataSource('AUDIT', [AuditLog]);

  try {
    await contentDs.initialize();
    await auditDs.initialize();

    const contents = await seedContent(contentDs);
    const totalLogs = await seedAudit(auditDs, contents);

    console.log('Seed analytics completed');
    console.log(`- Seeded content items: ${contents.length}`);
    console.log(`- Seeded audit logs: ${totalLogs}`);
  } finally {
    if (contentDs.isInitialized) {
      await contentDs.destroy();
    }
    if (auditDs.isInitialized) {
      await auditDs.destroy();
    }
  }
}

run().catch((error) => {
  console.error('Seed analytics failed:', error);
  process.exit(1);
});
