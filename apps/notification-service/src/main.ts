import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { NotificationModule } from './notification.module';

async function bootstrap() {
  // Create a temporary app context to access ConfigService (which runs Zod validation)
  const appContext = await NestFactory.createApplicationContext(NotificationModule, {
    logger: ['error', 'warn', 'log'],
  });
  const configService = appContext.get(ConfigService);
  const rabbitmqUrl = configService.getOrThrow<string>('RABBITMQ_URL');
  await appContext.close();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue: 'notification_queue',
        queueOptions: { durable: true },
        noAck: false,
      },
    },
  );

  await app.listen();
  console.log('🔔 Notification service is listening on RabbitMQ notification_queue');
}
bootstrap();

