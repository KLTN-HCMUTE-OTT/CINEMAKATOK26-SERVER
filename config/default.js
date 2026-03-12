const { aws, redis } = require('./custom-environment-variables');
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  //Server configuration
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
  // R2 Configuration
  r2: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketNameR2: process.env.R2_BUCKET_NAME,
    endpoint: process.env.R2_ENDPOINT,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  uploadDir: 'uploads/',
  // Email configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    fromName: process.env.EMAIL_FROM_NAME,
    secure: process.env.EMAIL_SECURE,
  },
  redis: {
    host: 'your_redis_host',
    port: 6379,
    password: 'your_redis_password',
  },

  // Core Config
  core: {
    database: {
      type: process.env.DATABASE_TYPE,
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      dbName: process.env.DATABASE_DBNAME,
      synchronize: true,
      caCertificate: null,
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
