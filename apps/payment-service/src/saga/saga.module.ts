import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentEntity } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { PaymentSaga } from './payment.saga';

/**
 * SagaModule wires all dependencies required by PaymentSaga:
 *  - TypeORM repositories (payment, saga_event_log, outbox_event)
 *  - ORDER_SERVICE client (TCP — RPC for subscription activation/cancellation)
 *  - NOTIFICATION_SERVICE client (RMQ — event emission for alerts)
 *  - AUDIT_SERVICE_MQ client (RMQ — targeted by OutboxRelayService)
 *  - RedisService (distributed locking + entitlement cache)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [PaymentEntity, SagaEventLogEntity, OutboxEvent],
      'payment',
    ),
    ClientsModule.registerAsync([
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get('ORDER_SERVICE_HOST') || 'localhost',
            port: Number(configService.get('ORDER_SERVICE_PORT')) || 3004,
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
  providers: [PaymentSaga],
  exports: [PaymentSaga],
})
export class SagaModule {}
