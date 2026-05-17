import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { DatabaseModule } from '@app/core/database/database.module';
import { RedisModule } from '@app/common';

import { OrderServiceController } from './order-service.controller';
import { SubscriptionService } from './services/subscription.service';
import { EntitySubscription } from './entities/subscription.entity';
import { EntitySubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionScheduler } from './services/subscription.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/order-service/.env'),
        path.resolve('.env'),
      ],
      isGlobal: true,
    }),
    DatabaseModule.forRoot({ service: 'order' }),
    TypeOrmModule.forFeature([EntitySubscription, EntitySubscriptionPlan], 'order'),
    ScheduleModule.forRoot(),
    RedisModule,
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL') || 'amqp://localhost:5672'],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [OrderServiceController],
  providers: [SubscriptionService, SubscriptionScheduler],
})
export class OrderServiceModule {}
