import { z } from 'zod';

const schema = z.object({
  // ── VNPAY ──────────────────────────────────────────────────────────────────
  VNPAY_TMN_CODE: z.string().min(1, 'VNPAY_TMN_CODE is required'),
  VNPAY_HASH_SECRET: z.string().min(32, 'VNPAY_HASH_SECRET must be at least 32 characters'),
  VNPAY_URL: z.string().url('VNPAY_URL must be a valid URL'),
  VNPAY_RETURN_URL: z.string().url('VNPAY_RETURN_URL must be a valid URL'),
  VNPAY_IPN_URL: z.string().url('VNPAY_IPN_URL must be a valid URL'),

  // ── Frontend origin (used for return-URL redirect) ─────────────────────────
  CLIENT_ORIGIN: z.string().url('CLIENT_ORIGIN must be a valid URL'),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT: z.preprocess((val) => Number(val ?? 6379), z.number()),
  REDIS_URL: z.string().optional(),

  // ── Database ───────────────────────────────────────────────────────────────
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.preprocess((val) => Number(val ?? 5432), z.number()),
  DB_USERNAME: z.string().min(1, 'DB_USERNAME is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_DATABASE: z.string().min(1, 'DB_DATABASE is required'),

  // ── RabbitMQ ───────────────────────────────────────────────────────────────
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
});

/**
 * Zod validation function for all required payment-service environment variables.
 * Passed to ConfigModule.forRoot({ validate }) so the app hard-fails
 * on start if any required variable is absent or malformed.
 */
export function validatePaymentConfig(config: Record<string, any>) {
  const result = schema.safeParse(config);
  if (!result.success) {
    console.error('❌ [payment-service] Environment validation failed:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Environment validation failed');
  }
  return result.data;
}
