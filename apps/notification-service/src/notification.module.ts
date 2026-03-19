import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

import { CoreModule } from '@app/core';

import { NotificationController } from './controllers/notification.controller';
import { EmailService } from './services/email.service';
import { validateNotificationEnv } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/notification-service/.env'),
        path.resolve('.env'),
      ],
      isGlobal: true,
      validate: validateNotificationEnv,
    }),
    CoreModule,
  ],
  controllers: [NotificationController],
  providers: [EmailService],
})
export class NotificationModule {}
