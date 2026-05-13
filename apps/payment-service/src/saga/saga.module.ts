import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { PaymentSaga } from './payment.saga';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, SagaEventLogEntity], 'payment'),
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
            queue: 'payment_queue',
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
