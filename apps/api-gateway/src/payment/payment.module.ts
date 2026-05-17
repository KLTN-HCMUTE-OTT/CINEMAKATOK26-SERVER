import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SubscriptionController } from './subscription.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'PAYMENT_SERVICE',
        imports: [ConfigModule],
        useFactory: (cs: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: cs.get('PAYMENT_SERVICE_HOST') ?? 'localhost',
            port: Number(cs.get('PAYMENT_SERVICE_PORT') ?? 3008),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (cs: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: cs.get('ORDER_SERVICE_HOST') ?? 'localhost',
            port: Number(cs.get('ORDER_SERVICE_PORT') ?? 3004),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'PAYMENT_SERVICE_MQ',
        imports: [ConfigModule],
        useFactory: (cs: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [cs.get('RABBITMQ_URL') ?? 'amqp://localhost:5672'],
            queue: 'payment_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [PaymentController, SubscriptionController, HealthController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
