import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SubscriptionController } from './subscription.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PAYMENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.PAYMENT_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.PAYMENT_SERVICE_PORT ?? 3008),
        },
      },
      {
        name: 'ORDER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.ORDER_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.ORDER_SERVICE_PORT ?? 3004),
        },
      },
    ]),
  ],
  controllers: [PaymentController, SubscriptionController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
