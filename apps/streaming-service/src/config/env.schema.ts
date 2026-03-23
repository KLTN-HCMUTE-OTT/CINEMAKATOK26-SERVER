import { z } from 'zod';

export const streamingEnvSchema = z.object({
  STREAMING_SERVICE_HOST: z.string().default('localhost'),
  STREAMING_SERVICE_PORT: z.coerce.number().default(3006),

  CONTENT_SERVICE_HOST: z.string().default('localhost'),
  CONTENT_SERVICE_PORT: z.coerce.number().default(3003),

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
