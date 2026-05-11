import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';

import { DatabaseModule } from '@app/core/database/database.module';

import { OrderServiceController } from './order-service.controller';
import { SubscriptionService } from './services/subscription.service';
import { EntitySubscription } from './entities/subscription.entity';

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
    TypeOrmModule.forFeature([EntitySubscription], 'order'),
  ],
  controllers: [OrderServiceController],
  providers: [SubscriptionService],
})
export class OrderServiceModule {}
