import { z } from 'zod';

export const contentEnvSchema = z.object({
  CONTENT_SERVICE_HOST: z.string().default('localhost'),
  CONTENT_SERVICE_PORT: z.coerce.number().default(3003),

  CONTENT_DB_TYPE: z.string().default('postgres'),
  CONTENT_DB_HOST: z.string().min(1, 'CONTENT_DB_HOST is required'),
  CONTENT_DB_PORT: z.coerce.number().default(5432),
  CONTENT_DB_USERNAME: z.string().min(1, 'CONTENT_DB_USERNAME is required'),
  CONTENT_DB_PASSWORD: z.string().min(1, 'CONTENT_DB_PASSWORD is required'),
  CONTENT_DB_NAME: z.string().min(1, 'CONTENT_DB_NAME is required'),
  CONTENT_DB_SYNCHRONIZE: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),
  CONTENT_DB_POOL_MAX: z.coerce.number().default(10),
  CONTENT_DB_POOL_MIN: z.coerce.number().default(2),
  CONTENT_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  CONTENT_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  CONTENT_DB_SSL_ENABLED: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),
  CONTENT_DB_SSL_REJECT_UNAUTHORIZED: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),

  // FastAPI Recommendation Service
  RECOMMENDATION_API_URL: z.string().url().optional(),
});

export type ContentEnv = z.infer<typeof contentEnvSchema>;

export const validateContentEnv = (config: Record<string, unknown>) => {
  const result = contentEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Content service env validation failed:\n${errors}`);
  }
  return result.data;
};
