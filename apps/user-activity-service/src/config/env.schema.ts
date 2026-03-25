import { z } from 'zod';

export const userActivityEnvSchema = z.object({
  USER_ACTIVITY_SERVICE_HOST: z.string().default('localhost'),
  USER_ACTIVITY_SERVICE_PORT: z.coerce.number().default(3007),

  ACTIVITY_DB_TYPE: z.string().default('postgres'),
  ACTIVITY_DB_HOST: z.string().min(1, 'ACTIVITY_DB_HOST is required'),
  ACTIVITY_DB_PORT: z.coerce.number().default(5432),
  ACTIVITY_DB_USERNAME: z.string().min(1, 'ACTIVITY_DB_USERNAME is required'),
  ACTIVITY_DB_PASSWORD: z.string().min(1, 'ACTIVITY_DB_PASSWORD is required'),
  ACTIVITY_DB_NAME: z.string().min(1, 'ACTIVITY_DB_NAME is required'),
  ACTIVITY_DB_SYNCHRONIZE: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),
  ACTIVITY_DB_POOL_MAX: z.coerce.number().default(10),
  ACTIVITY_DB_POOL_MIN: z.coerce.number().default(2),
  ACTIVITY_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  ACTIVITY_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  ACTIVITY_DB_SSL_ENABLED: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),
  ACTIVITY_DB_SSL_REJECT_UNAUTHORIZED: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),

  CONTENT_SERVICE_HOST: z.string().default('localhost'),
  CONTENT_SERVICE_PORT: z.coerce.number().default(3003),
});

export type UserActivityEnv = z.infer<typeof userActivityEnvSchema>;

export const validateUserActivityEnv = (config: Record<string, unknown>) => {
  const result = userActivityEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`User activity service env validation failed:\n${errors}`);
  }
  return result.data;
};
