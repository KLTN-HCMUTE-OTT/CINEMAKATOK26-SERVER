import { z } from 'zod';

// ========================
// Audit Log Service ENV Schema
// ========================
export const auditLogEnvSchema = z.object({
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CONTENT_SERVICE_HOST: z.string().default('localhost'),
  CONTENT_SERVICE_PORT: z.coerce.number().default(3003),
  // Database
  AUDIT_DB_TYPE: z.string().default('postgres'),
  AUDIT_DB_HOST: z.string().min(1, 'AUDIT_DB_HOST is required'),
  AUDIT_DB_PORT: z.coerce.number().default(5432),
  AUDIT_DB_USERNAME: z.string().min(1, 'AUDIT_DB_USERNAME is required'),
  AUDIT_DB_PASSWORD: z.string().min(1, 'AUDIT_DB_PASSWORD is required'),
  AUDIT_DB_NAME: z.string().min(1, 'AUDIT_DB_NAME is required'),
  AUDIT_DB_SYNCHRONIZE: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),
  AUDIT_DB_POOL_MAX: z.coerce.number().default(10),
  AUDIT_DB_POOL_MIN: z.coerce.number().default(2),
  AUDIT_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  AUDIT_DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  AUDIT_DB_SSL_ENABLED: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),
  AUDIT_DB_SSL_REJECT_UNAUTHORIZED: z
    .preprocess((v) => v === 'true' || v === '1', z.boolean())
    .default(false),
});

export type AuditLogEnv = z.infer<typeof auditLogEnvSchema>;

export const validateAuditLogEnv = (config: Record<string, unknown>) => {
  const result = auditLogEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Audit log service env validation failed:\n${errors}`);
  }
  return result.data;
};
