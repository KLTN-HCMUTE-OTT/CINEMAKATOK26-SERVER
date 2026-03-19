import { z } from 'zod';

// ========================
// Auth Service ENV Schema
// ========================
export const authEnvSchema = z.object({
  // Service
  AUTH_SERVICE_HOST: z.string().default('localhost'),
  AUTH_SERVICE_PORT: z.coerce.number().default(3002),

  // Database
  AUTH_DB_TYPE: z.string().default('postgres'),
  AUTH_DB_HOST: z.string().min(1, 'AUTH_DB_HOST is required'),
  AUTH_DB_PORT: z.coerce.number().default(5432),
  AUTH_DB_USERNAME: z.string().min(1, 'AUTH_DB_USERNAME is required'),
  AUTH_DB_PASSWORD: z.string().min(1, 'AUTH_DB_PASSWORD is required'),
  AUTH_DB_NAME: z.string().min(1, 'AUTH_DB_NAME is required'),
  AUTH_DB_SYNCHRONIZE: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  AUTH_DB_POOL_MAX: z.coerce.number().default(10),
  AUTH_DB_POOL_MIN: z.coerce.number().default(2),
  AUTH_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  AUTH_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  AUTH_DB_SSL_ENABLED: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  AUTH_DB_SSL_REJECT_UNAUTHORIZED: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().min(1, 'GOOGLE_CALLBACK_URL is required'),

  // SMTP
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),

  // JWT
  JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY is required'),
  JWT_PUBLIC_KEY: z.string().min(1, 'JWT_PUBLIC_KEY is required'),
  JWT_EXPIRES_TIME: z.string().default('5m'),
  JWT_REFRESH_EXPIRES_TIME: z.string().default('7d'),

  // RabbitMQ
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

export const validateAuthEnv = (config: Record<string, unknown>) => {
  const result = authEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Auth service env validation failed:\n${errors}`);
  }
  return result.data;
};