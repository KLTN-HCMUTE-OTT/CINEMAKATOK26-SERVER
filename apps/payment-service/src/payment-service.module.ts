import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { DatabaseModule } from '@app/core/database/database.module';

// ── Controller ───────────────────────────────────────────────────────────────
import { PaymentServiceController } from './payment-service.controller';

import { CommonModule } from '@app/common';
import { PaymentService } from './services/payment.service';
import { PaymentCallbackService } from './services/payment-callback.service';
import { OutboxRelayService } from './services/outbox-relay.service';
import { IdempotencyService } from './common/idempotency/idempotency.service';

import { RedisCacheService } from './services/redis-cache.service';
import { PaymentMetricsService } from './metrics/payment.metrics';
import { SagaMonitorService } from './admin/saga-monitor.service';
import { PaymentHealthService } from './health/payment.health';

// ── Cron Jobs ─────────────────────────────────────────────────────────────────
import { PaymentTimeoutJob } from './jobs/payment-timeout.job';
import { SubscriptionExpiryJob } from './jobs/subscription-expiry.job';

// ── Domain modules ────────────────────────────────────────────────────────────
import { VnpayModule } from './vnpay/vnpay.module';
import { SagaModule } from './saga/saga.module';

// ── Entities ─────────────────────────────────────────────────────────────────
import { PaymentEntity } from './entities/payment.entity';
import { SagaEventLogEntity } from './entities/saga-event-log.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { DlqEvent } from './entities/dlq-event.entity';
import { validatePaymentEnv } from '../config/env.schema';

// ── Config / Validation ───────────────────────────────────────────────────────

@Module({
  imports: [
    // ── Config (validates env vars on startup via Zod validate function) ──────────
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/payment-service/.env'),
        path.resolve('.env'),
      ],
      validate: validatePaymentEnv,
      isGlobal: true,
    }),

    // ── Database ──────────────────────────────────────────────────────────────
    DatabaseModule.forRoot({ service: 'payment' }),
    CommonModule,
    TypeOrmModule.forFeature(
      [PaymentEntity, SagaEventLogEntity, OutboxEvent, DlqEvent],
      'payment',
    ),

    // ── Cron scheduler ────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Domain modules ────────────────────────────────────────────────────────
    VnpayModule,
    SagaModule,

    // ── Microservice clients ──────────────────────────────────────────────────
    ClientsModule.registerAsync([
      {
        name: 'AUDIT_SERVICE_MQ',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get('RABBITMQ_URL') || 'amqp://localhost:5672'],
            queue: 'audit_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get('RABBITMQ_URL') || 'amqp://localhost:5672'],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get('ORDER_SERVICE_HOST') || 'localhost',
            port: Number(configService.get('ORDER_SERVICE_PORT') || 3004),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],

  controllers: [PaymentServiceController],

  providers: [
    // ── Core services (Part 1 & 2) ────────────────────────────────────────────
    PaymentService,
    PaymentCallbackService,
    OutboxRelayService,
    IdempotencyService,

    // ── New (Part 3) ──────────────────────────────────────────────────────────
    RedisCacheService,
    PaymentMetricsService,
    SagaMonitorService,
    PaymentHealthService,

    // ── Cron jobs ─────────────────────────────────────────────────────────────
    PaymentTimeoutJob,
    SubscriptionExpiryJob,
  ],
})
export class PaymentServiceModule {}
