import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
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
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>('USER_SERVICE_HOST') || 'localhost',
            port: Number(configService.get<number>('USER_SERVICE_PORT')) || 3002,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [NotificationController],
  providers: [EmailService],
})
export class NotificationModule {}
