import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/core/database/database.module';

import { validateUserActivityEnv } from './config/env.schema';
import { WatchProgressController } from './controllers/watch-progress.controller';
import { EntityWatchProgress } from './entities/watch-progress.entity';
import { WatchProgressService } from './services/watch-progress.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/user-activity-service/.env'),
        path.resolve('.env'),
      ],
      validate: validateUserActivityEnv,
      isGlobal: true,
    }),
    CoreModule,
    DatabaseModule.forRoot({ service: 'activity' }),
    TypeOrmModule.forFeature([EntityWatchProgress], 'activity'),
    ClientsModule.register([
      {
        name: 'CONTENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.CONTENT_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.CONTENT_SERVICE_PORT ?? 3003),
        },
      },
    ]),
  ],
  controllers: [WatchProgressController],
  providers: [WatchProgressService],
})
export class UserActivityModule {}
