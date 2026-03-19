import { z } from 'zod';

// ===========================
// Notification Service ENV Schema
// ===========================
export const notificationEnvSchema = z.object({
  // SMTP
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  SMTP_FROM_NAME: z.string().min(1, 'SMTP_FROM_NAME is required'),

  // RabbitMQ
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
});

export type NotificationEnv = z.infer<typeof notificationEnvSchema>;

export const validateNotificationEnv = (config: Record<string, unknown>) => {
  const result = notificationEnvSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Notification service env validation failed:\n${errors}`);
  }
  return result.data;
};
