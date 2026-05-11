import { z } from 'zod';

export const streamingEnvSchema = z.object({
  STREAMING_SERVICE_HOST: z.string().default('localhost'),
  STREAMING_SERVICE_PORT: z.coerce.number().default(3006),

  CONTENT_SERVICE_HOST: z.string().default('localhost'),
  CONTENT_SERVICE_PORT: z.coerce.number().default(3003),

  ORDER_SERVICE_HOST: z.string().default('localhost'),
  ORDER_SERVICE_PORT: z.coerce.number().default(3004),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_BUCKET_NAME: z.string().optional(),
  AWS_S3_BUCKET_URL: z.string().optional(),
  AWS_CLOUDFRONT_DOMAIN: z.string().optional(),
  AWS_CLOUDFRONT_KEY_PAIR_ID: z.string().optional(),
  AWS_CLOUDFRONT_PRIVATE_KEY: z.string().optional(),

  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Database for DRM keys
  STREAMING_DB_HOST: z.string().default('localhost'),
  STREAMING_DB_PORT: z.coerce.number().default(5432),
  STREAMING_DB_USERNAME: z.string().optional(),
  STREAMING_DB_PASSWORD: z.string().optional(),
  STREAMING_DB_NAME: z.string().optional(),
  STREAMING_DB_SYNCHRONIZE: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  STREAMING_DB_POOL_MAX: z.coerce.number().default(10),
  STREAMING_DB_POOL_MIN: z.coerce.number().default(2),
  STREAMING_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  STREAMING_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  STREAMING_DB_SSL_ENABLED: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  STREAMING_DB_SSL_REJECT_UNAUTHORIZED: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  // Shaka Packager
  SHAKA_PACKAGER_PATH: z.string().optional(),

  // Local Storage
  UPLOAD_DIR: z.string().default('uploads'),
  LOCAL_STORAGE_DIR: z.string().default('output'),
});

export type StreamingEnv = z.infer<typeof streamingEnvSchema>;

export const validateStreamingEnv = (config: Record<string, unknown>) => {
  const result = streamingEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Streaming service env validation failed:\n${errors}`);
  }
  return result.data;
};
