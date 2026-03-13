const { aws, uploadDir } = require('./default');

require('dotenv').config();

const number = (name) => ({ __name: name, __format: 'number' });
const boolean = (name) => ({ __name: name, __format: 'boolean' });
const json = (name) => ({ __name: name, __format: 'json' });

module.exports = {
  //Server configuration
  port: number('PORT'),
  appName: 'APP_NAME',
  recommendBaseUrl: 'RECOMMEND_BASE_URL',
  google: {
    clientID: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET',
    callbackURL: 'GOOGLE_CALLBACK_URL',
  },
  email: {
    host: 'SMTP_HOST',
    port: number('SMTP_PORT'),
    user: 'SMTP_USER',
    pass: 'SMTP_PASS',
    fromName: 'FROM_NAME',
    secure: boolean('SMTP_SECURE'),
  },
  aws: {
    accessKeyId: 'AWS_ACCESS_KEY_ID',
    secretAccessKey: 'AWS_SECRET_ACCESS_KEY',
    region: 'AWS_REGION',
    bucketName: 'AWS_BUCKET_NAME',
    s3BucketUrl: 'AWS_S3_BUCKET_URL',
    cloudfrontDomain: 'AWS_CLOUDFRONT_DOMAIN',
    cloudfrontKeyPairId: 'AWS_CLOUDFRONT_KEY_PAIR_ID',
    cloudfrontPrivateKey: 'AWS_CLOUDFRONT_PRIVATE_KEY',
  },
  r2: {
    accessKeyId: 'R2_ACCESS_KEY_ID',
    secretAccessKey: 'R2_SECRET_ACCESS_KEY',
    bucketNameR2: 'R2_BUCKET_NAME',
    endpoint: 'R2_ENDPOINT',
    publicUrl: 'R2_PUBLIC_URL',
  },
  uploadDir: 'UPLOAD_DIR',
  jwt: {
    privateKey: 'JWT_PRIVATE_KEY',
    publicKey: 'JWT_PUBLIC_KEY',
    expiresTime: 'ACCESS_TOKEN_EXPIRES_TIME',
    refreshExpiresTime: 'REFRESH_TOKEN_EXPIRES_TIME',
  },
  redis: {
    host: 'REDIS_HOST',
    port: number('REDIS_PORT'),
    password: 'REDIS_PASSWORD',
  },
  // Core Config
  core: {
    databases: {
      auth: {
        type: 'AUTH_DB_TYPE',
        host: 'AUTH_DB_HOST',
        port: number('AUTH_DB_PORT'),
        username: 'AUTH_DB_USERNAME',
        password: 'AUTH_DB_PASSWORD',
        dbName: 'AUTH_DB_NAME',
        synchronize: boolean('AUTH_DB_SYNCHRONIZE'),
        ssl: {
          enabled: boolean('AUTH_DB_SSL_ENABLED'),
          rejectUnauthorized: boolean('AUTH_DB_SSL_REJECT_UNAUTHORIZED'),
          caCertificate: 'AUTH_DB_CA_CERTIFICATE',
        },
        extra: {
          max: number('AUTH_DB_POOL_MAX'),
          min: number('AUTH_DB_POOL_MIN'),
          connectionLimit: number('AUTH_DB_POOL_CONNECTION_LIMIT'),
          idleTimeoutMillis: number('AUTH_DB_POOL_IDLE_TIMEOUT_MS'),
          connectTimeoutMillis: number('AUTH_DB_POOL_CONNECT_TIMEOUT_MS'),
        },
      },
      user: {
        type: 'USER_DB_TYPE',
        host: 'USER_DB_HOST',
        port: number('USER_DB_PORT'),
        username: 'USER_DB_USERNAME',
        password: 'USER_DB_PASSWORD',
        dbName: 'USER_DB_NAME',
        synchronize: boolean('USER_DB_SYNCHRONIZE'),
        ssl: {
          enabled: boolean('USER_DB_SSL_ENABLED'),
          rejectUnauthorized: boolean('USER_DB_SSL_REJECT_UNAUTHORIZED'),
          caCertificate: 'USER_DB_CA_CERTIFICATE',
        },
        extra: {
          max: number('USER_DB_POOL_MAX'),
          min: number('USER_DB_POOL_MIN'),
          connectionLimit: number('USER_DB_POOL_CONNECTION_LIMIT'),
          idleTimeoutMillis: number('USER_DB_POOL_IDLE_TIMEOUT_MS'),
          connectTimeoutMillis: number('USER_DB_POOL_CONNECT_TIMEOUT_MS'),
        },
      },
    },
    cache: {
      store: 'CORE_CACHE_STORE',
      ttl: number('CORE_CACHE_TTL'), //in milliseconds
      max: number('CORE_CACHE_MAX'), // max items
    },
    healthCheck: {
      disk: {
        path: 'CORE_HEALTHCHECK_DISK_PATH',
        thresholdPercent: number('CORE_HEALTHCHECK_DISK_THRESHOLDPERCENT'), // in bytes
        enable: boolean('CORE_HEALTHCHECK_DISK_ENABLE'),
      },
      memory: {
        heapThreshold: number('CORE_HEALTHCHECK_MEMORY_HEAPTHRESHOLD'), // in bytes
        rssThreshold: number('CORE_HEALTHCHECK_MEMORY_RSSTHRESHOLD'), // in bytes
        enableHeapCheck: boolean('CORE_HEALTHCHECK_MEMORY_ENABLEHEAPCHECK'),
        enableRssCheck: boolean('CORE_HEALTHCHECK_MEMORY_ENABLERSSCHECK'),
      },
      database: {
        enable: boolean('CORE_HEALTHCHECK_DATABASE_ENABLE'),
      },
      http: {
        url: 'CORE_HEALTHCHECK_HTTP_URL',
        enable: boolean('CORE_HEALTHCHECK_HTTP_ENABLE'),
      },
    },
    axios: {
      timeout: number('CORE_AXIOS_TIMEOUT'), // in milliseconds
    },
  },
};
