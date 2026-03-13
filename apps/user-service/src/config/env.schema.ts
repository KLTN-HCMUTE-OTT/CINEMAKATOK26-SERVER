import { z } from 'zod';

// ========================
// User Service ENV Schema
// ========================
export const userEnvSchema = z.object({
  // Service
  USER_SERVICE_HOST: z.string().default('localhost'),
  USER_SERVICE_PORT: z.coerce.number().default(3002),

  // Database
  USER_DB_TYPE: z.string().default('postgres'),
  USER_DB_HOST: z.string().min(1, 'USER_DB_HOST is required'),
  USER_DB_PORT: z.coerce.number().default(5432),
  USER_DB_USERNAME: z.string().min(1, 'USER_DB_USERNAME is required'),
  USER_DB_PASSWORD: z.string().min(1, 'USER_DB_PASSWORD is required'),
  USER_DB_NAME: z.string().min(1, 'USER_DB_NAME is required'),
  USER_DB_SYNCHRONIZE: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  USER_DB_POOL_MAX: z.coerce.number().default(10),
  USER_DB_POOL_MIN: z.coerce.number().default(2),
  USER_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  USER_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  USER_DB_SSL_ENABLED: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  USER_DB_SSL_REJECT_UNAUTHORIZED: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
});

export type UserEnv = z.infer<typeof userEnvSchema>;

export const validateUserEnv = (config: Record<string, unknown>) => {
  const result = userEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`User service env validation failed:\n${errors}`);
  }
  return result.data;
};