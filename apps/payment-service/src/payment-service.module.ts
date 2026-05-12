import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { DatabaseModule } from '@app/core/database/database.module';

import { PaymentServiceController } from './payment-service.controller';
import { PaymentService } from './services/payment.service';
import { SagaOrchestratorService } from './services/saga-orchestrator.service';
import { VnpayService } from './services/vnpay.service';
import { RedisService } from './services/redis.service';

import { PaymentEntity } from './entities/payment.entity';
import { SagaEventLogEntity } from './entities/saga-event-log.entity';


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
    TypeOrmModule.forFeature([PaymentEntity, SagaEventLogEntity], 'payment'),
    ScheduleModule.forRoot(),
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.ORDER_SERVICE_HOST || 'localhost',
          port: Number(process.env.ORDER_SERVICE_PORT) || 3004,
        },
      },
      {
        name: 'NOTIFICATION_SERVICE_MQ',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'notification_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [PaymentServiceController],
  providers: [
    PaymentService,
    SagaOrchestratorService,
    VnpayService,
    RedisService,
  ],
})
export class PaymentServiceModule {}
