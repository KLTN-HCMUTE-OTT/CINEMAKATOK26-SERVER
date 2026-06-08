/**
 * Full content seed for the CinemaKatoK demo.
 *
 * Seeds ~100 movies and ~50 TV series (with seasons + episodes) into the
 * content database, each wired to ONE already-processed, DRM-protected video
 * so every title is immediately playable on the front-end.
 *
 * How playback works for the seed (important):
 *   - Every movie/episode gets a `video` row whose `videoUrl` points to the
 *     real DASH manifest of video 08cb6063-... that was previously uploaded,
 *     transcoded and CENC-encrypted by the streaming worker.
 *   - Shaka Player reads the keyId embedded in that manifest and asks the
 *     ClearKey license endpoint for the content key. The license server looks
 *     keys up BY keyId (not by videoId), and that key already exists in the
 *     streaming database (drm_key.keyId = 4c453a8d...). So every seeded title
 *     decrypts and plays using the same shared key — no new DRM rows needed.
 *   - All AI-moderation flags (isViolent / isNude / scores / segments) are set
 *     to false / null / empty so nothing is blocked or blurred.
 *
 * Run:  pnpm seed:content
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { DataSource } from 'typeorm';

import { ACCESS_TIER, GENDER, VIDEO_STATUS } from '@app/common/enums/global.enum';

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
import {
  EntityVideo,
  VideoOwnerType,
} from '../apps/content-service/src/entities/video.entity';

import { CATEGORIES, CatalogItem, MOVIES, TAGS } from './data/catalog';
import { SERIES } from './data/series';
import { FALLBACK_TRAILERS, TRAILERS } from './data/trailers';

// ─── Shared, already-processed media (DRM-protected, plays on the FE) ────────
const SHARED = {
  // Real DASH manifest produced by the streaming worker for video 08cb6063-...
  // The manifest embeds DRM keyId 4c453a8d… which already exists in drm_key.
  manifestUrl:
    'https://ottstorage.s3.ap-southeast-1.amazonaws.com/videos/08cb6063-1627-4ce2-a0af-c27d7989b9f4/dash/manifest.mpd',
  thumbnailUrl:
    'https://pub-9ca10bb10ad245999227e7c277a725ec.r2.dev/videos/08cb6063-1627-4ce2-a0af-c27d7989b9f4/thumbnails/1780402540772-Stranger_Things_5__Final_Trailer_2___Netflix-1780402514108-378774823.png',
  sprites: [
    'https://pub-9ca10bb10ad245999227e7c277a725ec.r2.dev/videos/08cb6063-1627-4ce2-a0af-c27d7989b9f4/sprites/1780402550101-sprite_08cb6063-1627-4ce2-a0af-c27d7989b9f4_0.jpg',
  ],
  vttFiles: [
    'https://pub-9ca10bb10ad245999227e7c277a725ec.r2.dev/videos/08cb6063-1627-4ce2-a0af-c27d7989b9f4/sprites/1780402550412-sprite_08cb6063-1627-4ce2-a0af-c27d7989b9f4_0.vtt',
  ],
  // The key that protects the shared manifest. Used only to verify it exists.
  drmKeyId: '4c453a8db8e4536fd3ca8c6da44cae0d',
};

const TMDB_IMG = 'https://image.tmdb.org/t/p';
const posterUrl = (path: string) => `${TMDB_IMG}/w500/${path}`;
const bannerUrl = (path: string) => `${TMDB_IMG}/w1280/${path}`;
const youtubeUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
// Real human portrait photos (gendered) for actors/directors.
const portraitUrl = (gender: GENDER, n: number) =>
  `https://randomuser.me/api/portraits/${gender === GENDER.FEMALE ? 'women' : 'men'}/${n % 100}.jpg`;

// Verified-good posters used as a fallback when an item's poster path 404s,
// guaranteeing every title shows a real, non-broken movie poster.
const FALLBACK_POSTERS = [
  'oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', // Inception
  'gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', // Interstellar
  'qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
  '7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
  'or06FN3Dka5tukK1e9sl16pB3iy.jpg', // Avengers: Endgame
  'udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', // Joker
  'd5NXSklXo0qyIYkgV94XAgMIckC.jpg', // Dune
  '8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', // Oppenheimer
  '39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', // Spirited Away
  'f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', // The Matrix
];

// ─── env loading (mirrors db/seed-analytics.ts) ─────────────────────────────
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(resolve('.env'));
loadEnvFile(resolve('apps/content-service/.env'));

// ─── small helpers ──────────────────────────────────────────────────────────
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)];
const pickMany = <T>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

// People pools (real names + gender) for actors/directors.
const F = GENDER.FEMALE;
const M = GENDER.MALE;
const ACTOR_NAMES: { name: string; gender: GENDER }[] = [
  { name: 'Leonardo DiCaprio', gender: M }, { name: 'Margot Robbie', gender: F },
  { name: 'Denzel Washington', gender: M }, { name: 'Scarlett Johansson', gender: F },
  { name: 'Tom Hardy', gender: M }, { name: 'Cate Blanchett', gender: F },
  { name: 'Cillian Murphy', gender: M }, { name: 'Florence Pugh', gender: F },
  { name: 'Ryan Gosling', gender: M }, { name: 'Emma Stone', gender: F },
  { name: 'Christian Bale', gender: M }, { name: 'Zendaya', gender: F },
  { name: 'Joaquin Phoenix', gender: M }, { name: 'Saoirse Ronan', gender: F },
  { name: 'Timothée Chalamet', gender: M }, { name: 'Anya Taylor-Joy', gender: F },
  { name: 'Brad Pitt', gender: M }, { name: 'Charlize Theron', gender: F },
  { name: 'Idris Elba', gender: M }, { name: 'Viola Davis', gender: F },
  { name: 'Oscar Isaac', gender: M }, { name: 'Jessica Chastain', gender: F },
  { name: 'Pedro Pascal', gender: M }, { name: 'Florence Kasumba', gender: F },
  { name: 'Mahershala Ali', gender: M }, { name: 'Lupita Nyong’o', gender: F },
  { name: 'Adam Driver', gender: M }, { name: 'Rachel Weisz', gender: F },
  { name: 'Robert Pattinson', gender: M }, { name: 'Zoe Saldaña', gender: F },
  { name: 'Hugh Jackman', gender: M }, { name: 'Natalie Portman', gender: F },
  { name: 'Keanu Reeves', gender: M }, { name: 'Gal Gadot', gender: F },
  { name: 'Michael B. Jordan', gender: M }, { name: 'Tilda Swinton', gender: F },
];
const DIRECTOR_NAMES: { name: string; gender: GENDER }[] = [
  { name: 'Christopher Nolan', gender: M }, { name: 'Denis Villeneuve', gender: M },
  { name: 'Greta Gerwig', gender: F }, { name: 'Bong Joon-ho', gender: M },
  { name: 'Martin Scorsese', gender: M }, { name: 'Quentin Tarantino', gender: M },
  { name: 'Hayao Miyazaki', gender: M }, { name: 'Jordan Peele', gender: M },
  { name: 'Ridley Scott', gender: M }, { name: 'Steven Spielberg', gender: M },
  { name: 'Damien Chazelle', gender: M }, { name: 'Taika Waititi', gender: M },
  { name: 'Kathryn Bigelow', gender: F }, { name: 'Wes Anderson', gender: M },
  { name: 'Alfonso Cuarón', gender: M }, { name: 'Guillermo del Toro', gender: M },
];

const BIO = (name: string, role: string) =>
  `${name} is an acclaimed ${role} known for a string of critically praised, award-winning projects.`;

// HEAD-check TMDB posters with limited concurrency; returns set of valid paths.
async function verifyPosters(paths: string[]): Promise<Set<string>> {
  const unique = [...new Set(paths)];
  const valid = new Set<string>();
  const CONCURRENCY = 16;
  let idx = 0;
  let failures = 0;
  async function worker() {
    while (idx < unique.length) {
      const p = unique[idx++];
      try {
        const res = await fetch(posterUrl(p), { method: 'HEAD' });
        if (res.ok) valid.add(p);
        else failures++;
      } catch {
        failures++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(
    `Verified posters: ${valid.size}/${unique.length} OK, ${failures} fell back.`,
  );
  return valid;
}

// Validate YouTube trailer ids via the oEmbed endpoint (200 => embeddable).
async function verifyTrailers(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.map((i) => i.trim()))].filter(Boolean);
  const valid = new Set<string>();
  const CONCURRENCY = 12;
  let idx = 0;
  async function worker() {
    while (idx < unique.length) {
      const id = unique[idx++];
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(id)}&format=json`,
        );
        if (res.ok) valid.add(id);
      } catch {
        /* treated as invalid */
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Verified trailers: ${valid.size}/${unique.length} embeddable.`);
  return valid;
}

function buildContentDataSource() {
  return new DataSource({
    type: 'postgres',
    host: process.env.CONTENT_DB_HOST,
    port: Number(process.env.CONTENT_DB_PORT || 5432),
    username: process.env.CONTENT_DB_USERNAME,
    password: process.env.CONTENT_DB_PASSWORD,
    database: process.env.CONTENT_DB_NAME,
    synchronize: false,
    logging: false,
    entities: [
      EntityContent,
      EntityMovie,
      EntityTVSeries,
      EntitySeason,
      EntityEpisode,
      EntityCategory,
      EntityActor,
      EntityDirector,
      EntityTag,
      EntityVideo,
    ],
  });
}

function buildStreamingDataSource() {
  return new DataSource({
    type: 'postgres',
    host: process.env.STREAMING_DB_HOST?.trim(),
    port: Number((process.env.STREAMING_DB_PORT || '5432').trim()),
    username: process.env.STREAMING_DB_USERNAME?.trim(),
    password: process.env.STREAMING_DB_PASSWORD?.trim(),
    database: process.env.STREAMING_DB_NAME?.trim(),
    synchronize: false,
    logging: false,
    entities: [],
  });
}

async function verifyDrmKey() {
  const ds = buildStreamingDataSource();
  try {
    await ds.initialize();
    const rows = await ds.query(
      'SELECT "keyId" FROM drm_key WHERE "keyId" = $1 LIMIT 1',
      [SHARED.drmKeyId],
    );
    if (rows.length) {
      console.log(
        `DRM key ${SHARED.drmKeyId.slice(0, 8)}… present in streaming DB — videos will decrypt.`,
      );
    } else {
      console.warn(
        `WARNING: DRM key ${SHARED.drmKeyId} not found in streaming DB. ` +
          'Playback will fail until the shared video is (re)processed.',
      );
    }
  } catch (err) {
    console.warn(
      'Could not verify DRM key (streaming DB unreachable):',
      (err as Error).message,
    );
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}

async function main() {
  console.log('Seeding full content catalog...');

  // 1) Verify every poster path up-front. Failed paths fall back to one of the
  //    runtime-verified posters (a large, varied pool of real posters) so no
  //    image is ever broken.
  const allPosters = [...MOVIES, ...SERIES].map((c) => c.poster);
  const validPosters = await verifyPosters(allPosters);
  const fallbackPool = validPosters.size
    ? [...validPosters].sort()
    : FALLBACK_POSTERS;
  const resolvePoster = (path: string, seed: number) =>
    validPosters.has(path)
      ? path
      : fallbackPool[seed % fallbackPool.length];

  // 1b) Verify every curated trailer id; failures fall back to a real trailer.
  const validTrailers = await verifyTrailers([
    ...Object.values(TRAILERS),
    ...FALLBACK_TRAILERS,
  ]);
  const trailerFallbackPool = FALLBACK_TRAILERS.filter((id) =>
    validTrailers.has(id),
  );
  const resolveTrailer = (title: string, seed: number) => {
    const id = TRAILERS[title]?.trim();
    if (id && validTrailers.has(id)) return id;
    const pool = trailerFallbackPool.length ? trailerFallbackPool : FALLBACK_TRAILERS;
    return pool[seed % pool.length];
  };

  await verifyDrmKey();

  const ds = buildContentDataSource();
  await ds.initialize();

  // 2) Clean slate (content DB only — streaming DRM keys are untouched).
  await ds.query(`
    TRUNCATE TABLE
      "content_category", "content_actor", "content_director", "content_tag",
      "episode", "season", "tvseries", "movies", "video", "content",
      "category", "actor", "director", "tag"
    RESTART IDENTITY CASCADE;
  `);

  const categoryRepo = ds.getRepository(EntityCategory);
  const tagRepo = ds.getRepository(EntityTag);
  const actorRepo = ds.getRepository(EntityActor);
  const directorRepo = ds.getRepository(EntityDirector);
  const movieRepo = ds.getRepository(EntityMovie);
  const tvRepo = ds.getRepository(EntityTVSeries);
  const videoRepo = ds.getRepository(EntityVideo);

  // 3) Lookups: categories, tags, people.
  const categories = await categoryRepo.save(
    CATEGORIES.map((categoryName) => categoryRepo.create({ categoryName })),
  );
  const catByName = new Map(categories.map((c) => [c.categoryName, c]));

  const tags = await tagRepo.save(TAGS.map((tagName) => tagRepo.create({ tagName })));

  // Stable per-gender counters so each person gets a distinct real portrait.
  let menIdx = 0;
  let womenIdx = 0;
  const portraitFor = (gender: GENDER) =>
    portraitUrl(gender, gender === GENDER.FEMALE ? womenIdx++ : menIdx++);

  const actors = await actorRepo.save(
    ACTOR_NAMES.map(({ name, gender }) =>
      actorRepo.create({
        name,
        gender,
        nationality: pick(['American', 'British', 'Australian', 'Canadian', 'Irish']),
        bio: BIO(name, 'actor'),
        profilePicture: portraitFor(gender),
        dateOfBirth: new Date(randInt(1960, 1998), randInt(0, 11), randInt(1, 28)),
      }),
    ),
  );

  const directors = await directorRepo.save(
    DIRECTOR_NAMES.map(({ name, gender }) =>
      directorRepo.create({
        name,
        gender,
        nationality: pick(['American', 'British', 'Canadian', 'Mexican', 'Japanese']),
        bio: BIO(name, 'director'),
        profilePicture: portraitFor(gender),
        dateOfBirth: new Date(randInt(1945, 1985), randInt(0, 11), randInt(1, 28)),
      }),
    ),
  );

  const buildMeta = (item: CatalogItem, type: ContentType, seed: number) => {
    const poster = resolvePoster(item.poster, seed);
    const genreCats = item.genres
      .map((g) => catByName.get(g))
      .filter((c): c is EntityCategory => Boolean(c));
    return {
      type,
      title: item.title,
      description: item.overview,
      releaseDate: new Date(item.year, randInt(0, 11), randInt(1, 28)),
      thumbnail: posterUrl(poster),
      banner: bannerUrl(poster),
      trailer: youtubeUrl(resolveTrailer(item.title, seed)),
      avgRating: round1(Math.max(0, Math.min(10, item.imdb + (Math.random() - 0.5)))),
      imdbRating: item.imdb,
      maturityRating: item.maturity as any,
      viewCount: randInt(500, 5_000_000),
      accessTier: ACCESS_TIER.BASIC,
      categories: genreCats.length ? genreCats : [pick(categories)],
      actors: pickMany(actors, randInt(3, 6)),
      directors: pickMany(directors, randInt(1, 2)),
      tags: pickMany(tags, randInt(1, 3)),
    } as Partial<EntityContent>;
  };

  // 4) Movies — content (cascade) + movie row + one shared video.
  console.log(`Seeding ${MOVIES.length} movies...`);
  let movieCount = 0;
  for (let i = 0; i < MOVIES.length; i++) {
    const item = MOVIES[i];
    const movie = await movieRepo.save(
      movieRepo.create({
        duration: randInt(85, 175),
        metaData: buildMeta(item, ContentType.MOVIE, i) as EntityContent,
      }),
    );
    await videoRepo.save(
      videoRepo.create({
        ...sharedVideo(),
        ownerType: VideoOwnerType.MOVIE,
        ownerId: movie.id,
      }),
    );
    movieCount++;
  }

  // 5) TV series — content + seasons + episodes, one shared video per episode.
  console.log(`Seeding ${SERIES.length} TV series...`);
  let seasonCount = 0;
  let episodeCount = 0;
  for (let i = 0; i < SERIES.length; i++) {
    const item = SERIES[i];
    const numSeasons = randInt(1, 3);
    const seasons: Partial<EntitySeason>[] = [];
    for (let sNum = 1; sNum <= numSeasons; sNum++) {
      const numEpisodes = randInt(6, 10);
      const episodes: Partial<EntityEpisode>[] = [];
      for (let eNum = 1; eNum <= numEpisodes; eNum++) {
        episodes.push({
          episodeNumber: eNum,
          episodeDuration: randInt(35, 62),
          episodeTitle: `Episode ${eNum}`,
          episodeThumbnail: bannerUrl(resolvePoster(item.poster, i)),
        });
      }
      seasons.push({
        seasonNumber: sNum,
        totalEpisodes: numEpisodes,
        episodes: episodes as EntityEpisode[],
      });
      seasonCount++;
      episodeCount += numEpisodes;
    }

    const series = await tvRepo.save(
      tvRepo.create({
        metaData: buildMeta(item, ContentType.TVSERIES, i) as EntityContent,
        seasons: seasons as EntitySeason[],
      }),
    );

    // Attach one shared video to each saved episode.
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        await videoRepo.save(
          videoRepo.create({
            ...sharedVideo(),
            ownerType: VideoOwnerType.EPISODE,
            ownerId: ep.id,
          }),
        );
      }
    }
  }

  await ds.destroy();

  console.log('\nSeed complete:');
  console.log(`  Movies       : ${movieCount}`);
  console.log(`  TV series    : ${SERIES.length}`);
  console.log(`  Seasons      : ${seasonCount}`);
  console.log(`  Episodes     : ${episodeCount}`);
  console.log(`  Videos       : ${movieCount + episodeCount}`);
  console.log(`  Categories   : ${categories.length}`);
  console.log(`  Actors       : ${actors.length}`);
  console.log(`  Directors    : ${directors.length}`);
  console.log('\nEvery title plays the shared DRM-protected manifest.');
}

// Plain video payload shared by every movie/episode (all moderation flags off).
function sharedVideo(): Partial<EntityVideo> {
  return {
    videoUrl: SHARED.manifestUrl,
    status: VIDEO_STATUS.READY,
    thumbnailUrl: SHARED.thumbnailUrl,
    sprites: SHARED.sprites,
    vttFiles: SHARED.vttFiles,
    isViolent: false,
    violenceScore: null,
    violentSegments: [],
    isNude: false,
    nudityScore: null,
    nuditySegments: [],
  };
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
