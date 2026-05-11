import { z } from 'zod';

export const streamingEnvSchema = z.object({
  ORDER_DB_HOST: z.string().default('localhost'),
  ORDER_DB_PORT: z.coerce.number().default(5432),
  ORDER_DB_USERNAME: z.string().optional(),
  ORDER_DB_PASSWORD: z.string().optional(),
  ORDER_DB_NAME: z.string().optional(),
  ORDER_DB_SYNCHRONIZE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ORDER_DB_POOL_MAX: z.coerce.number().default(10),
  ORDER_DB_POOL_MIN: z.coerce.number().default(2),
  ORDER_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  ORDER_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  ORDER_DB_SSL_ENABLED: z.boolean().default(false),
  ORDER_DB_SSL_REJECT_UNAUTHORIZED: z.boolean().default(false),
});

export type OrderEnv = z.infer<typeof streamingEnvSchema>;

export const validateOrderEnv = (config: Record<string, unknown>) => {
  const result = streamingEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Order service env validation failed:\n${errors}`);
  }
  return result.data;
};
