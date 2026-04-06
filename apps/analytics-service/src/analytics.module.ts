import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { AnalyticsController } from './controller/analytics.controller';
import { AnalyticsService } from './service/analytics.service';
import { ForecastTrainingScheduler } from './scheduler/forecast-training.scheduler';
import { ChurnTrainingScheduler } from './scheduler/churn-training.scheduler';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CONTENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.CONTENT_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.CONTENT_SERVICE_PORT ?? 3003),
        },
      },
      {
        name: 'AUDIT_LOG_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
          queue: 'audit_log_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ForecastTrainingScheduler,
    ChurnTrainingScheduler,
  ],
})
export class AnalyticsModule {}
