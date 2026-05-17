import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { DatabaseModule } from '@app/core/database/database.module';

import { PaymentServiceController } from './payment-service.controller';
import { PaymentService } from './services/payment.service';
import { PaymentCallbackService } from './services/payment-callback.service';
import { OutboxRelayService } from './services/outbox-relay.service';
import { RedisService } from './services/redis.service';
import { IdempotencyService } from './common/idempotency/idempotency.service';
import { VnpayModule } from './vnpay/vnpay.module';
import { SagaModule } from './saga/saga.module';

import { PaymentEntity } from './entities/payment.entity';
import { SagaEventLogEntity } from './entities/saga-event-log.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { DlqEvent } from './entities/dlq-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/payment-service/.env'),
        path.resolve('.env'),
      ],
      isGlobal: true,
    }),
    DatabaseModule.forRoot({ service: 'payment' }),
    TypeOrmModule.forFeature(
      [PaymentEntity, SagaEventLogEntity, OutboxEvent, DlqEvent],
      'payment',
    ),
    ScheduleModule.forRoot(),
    VnpayModule,
    SagaModule,
    // AUDIT_SERVICE_MQ client — used by OutboxRelayService
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
    ]),
  ],
  controllers: [PaymentServiceController],
  providers: [
    PaymentService,
    PaymentCallbackService,
    OutboxRelayService,
    RedisService,
    IdempotencyService,
  ],
})
export class PaymentServiceModule {}
