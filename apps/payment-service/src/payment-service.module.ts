import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { DatabaseModule } from '@app/core/database/database.module';

import { PaymentServiceController } from './payment-service.controller';
import { PaymentService } from './services/payment.service';
import { RedisService } from './services/redis.service';
import { IdempotencyService } from './common/idempotency/idempotency.service';
import { VnpayModule } from './vnpay/vnpay.module';
import { SagaModule } from './saga/saga.module';

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
    VnpayModule,
    SagaModule,
  ],
  controllers: [PaymentServiceController],
  providers: [
    PaymentService,
    RedisService,
    IdempotencyService,
  ],
})
export class PaymentServiceModule {}
