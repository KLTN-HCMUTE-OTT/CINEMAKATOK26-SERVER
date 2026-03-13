import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderController } from './user-activity.controller';
import { UserActivityService } from './user-activity.service';

@Module({
  imports: [
    ClientsModule.register([
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
  controllers: [OrderController],
  providers: [UserActivityService],
  exports: [UserActivityService],
})
export class UserActivityModule {}
