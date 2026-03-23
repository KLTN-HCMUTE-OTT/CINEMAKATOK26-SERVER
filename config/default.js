const dotenv = require('dotenv');
const path = require('path');

// ========================
// Load .env theo service
// SERVICE_NAME được set trong package.json scripts
// ========================
const SERVICE_NAME = process.env.SERVICE_NAME;

if (SERVICE_NAME) {
  // Load service-specific .env TRƯỚC (ưu tiên cao nhất)
  dotenv.config({
    path: path.resolve(`apps/${SERVICE_NAME}/.env`),
    override: false,
  });
}

// Load shared .env ở root (fallback)
dotenv.config({ path: path.resolve('.env'), override: false });

// ========================
// Helpers
// ========================
const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const dbConfig = (prefix) => ({
  type: process.env[`${prefix}_DB_TYPE`] || 'postgres',
  host: process.env[`${prefix}_DB_HOST`] || '',
  port: toNumber(process.env[`${prefix}_DB_PORT`], 5432),
  username: process.env[`${prefix}_DB_USERNAME`] || '',
  password: process.env[`${prefix}_DB_PASSWORD`] || '',
  dbName: process.env[`${prefix}_DB_NAME`] || '',
  synchronize: toBoolean(
    process.env[`${prefix}_DB_SYNCHRONIZE`],
    toBoolean(process.env.CORE_DATABASE_SYNCHRONIZE, false),
  ),
  ssl: {
    enabled: toBoolean(process.env[`${prefix}_DB_SSL_ENABLED`], false),
    rejectUnauthorized: toBoolean(
      process.env[`${prefix}_DB_SSL_REJECT_UNAUTHORIZED`],
      false,
    ),
    caCertificate:
      process.env[`${prefix}_DB_CA_CERTIFICATE`] ||
      process.env.DB_CA_CERTIFICATE,
  },
  extra: {
    max: toNumber(process.env[`${prefix}_DB_POOL_MAX`], 10),
    min: toNumber(process.env[`${prefix}_DB_POOL_MIN`], 2),
    idleTimeoutMillis: toNumber(
      process.env[`${prefix}_DB_POOL_IDLE_TIMEOUT_MS`],
      30000,
    ),
    connectTimeoutMillis: toNumber(
      process.env[`${prefix}_DB_POOL_CONNECT_TIMEOUT_MS`],
      5000,
    ),
  },
});

module.exports = {
  port: 3000,
  appName: process.env.APP_NAME,

  jwt: {
    privateKey: process.env.JWT_PRIVATE_KEY,
    publicKey: process.env.JWT_PUBLIC_KEY,
    expiresTime: process.env.JWT_EXPIRES_TIME,
    refreshExpiresTime: process.env.JWT_REFRESH_EXPIRES_TIME,
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucketName: process.env.AWS_BUCKET_NAME,
    s3BucketUrl: process.env.AWS_S3_BUCKET_URL,
    cloudfrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
    cloudfrontKeyPairId: process.env.AWS_CLOUDFRONT_KEY_PAIR_ID,
    cloudfrontPrivateKey: process.env.AWS_CLOUDFRONT_PRIVATE_KEY,
  },

  r2: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketNameR2: process.env.R2_BUCKET_NAME,
    endpoint: process.env.R2_ENDPOINT,
    publicUrl: process.env.R2_PUBLIC_URL,
  },

  uploadDir: 'D:\\uploads',

  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    fromName: process.env.EMAIL_FROM_NAME,
    secure: process.env.EMAIL_SECURE,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: toNumber(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || '',
  },

  core: {
    databases: {
      auth: dbConfig('AUTH'),
      user: dbConfig('USER'),
    },
    cache: {
      store: 'memory',
      ttl: 5000,
      max: 100,
    },
    healthCheck: {
      disk: {
        path: 'C:\\',
        thresholdPercent: 0.6,
        enable: false,
      },
      memory: {
        heapThreshold: 314572800,
        rssThreshold: 314572800,
        enableHeapCheck: false,
        enableRssCheck: false,
      },
      database: {
        enable: true,
      },
      http: {
        url: 'http://localhost:3000/docs#',
        enable: true,
      },
    },
    axios: {
      timeout: 3000,
    },
  },
};
