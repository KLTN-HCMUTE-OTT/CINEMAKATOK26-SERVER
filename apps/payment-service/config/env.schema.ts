import { z } from 'zod';

export const paymentEnvSchema = z.object({
  PAYMENT_DB_HOST: z.string().default('localhost'),
  PAYMENT_DB_PORT: z.coerce.number().default(5432),
  PAYMENT_DB_USERNAME: z.string().optional(),
  PAYMENT_DB_PASSWORD: z.string().optional(),
  PAYMENT_DB_NAME: z.string().optional(),
  PAYMENT_DB_SYNCHRONIZE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  PAYMENT_DB_POOL_MAX: z.coerce.number().default(10),
  PAYMENT_DB_POOL_MIN: z.coerce.number().default(2),
  PAYMENT_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  PAYMENT_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  PAYMENT_DB_SSL_ENABLED: z.boolean().default(false),
  PAYMENT_DB_SSL_REJECT_UNAUTHORIZED: z.boolean().default(false),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  PAYMENT_SERVICE_PORT: z.coerce.number().default(3008),
  PAYMENT_SERVICE_HOST: z.string().default('localhost'),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),

  VNPAY_TMN_CODE: z.string(),
  VNPAY_HASH_SECRET: z.string(),
  VNPAY_URL: z.string(),
  VNPAY_RETURN_URL: z.string(),

  ORDER_SERVICE_HOST: z.string().default('localhost'),
  ORDER_SERVICE_PORT: z.coerce.number().default(3004),
});

export type PaymentEnv = z.infer<typeof paymentEnvSchema>;

export const validatePaymentEnv = (config: Record<string, unknown>) => {
  const result = paymentEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Payment service env validation failed:\n${errors}`);
  }
  return result.data;
};
