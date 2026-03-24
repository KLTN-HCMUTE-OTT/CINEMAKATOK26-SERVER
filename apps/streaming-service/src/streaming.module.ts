import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

import { StreamingController } from './streaming.controller';
import { validateStreamingEnv } from './config/env.schema';
import {
  ContentVideoService,
  QueueService,
  R2StorageService,
  S3Service,
  StreamingService,
} from './services';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/streaming-service/.env'),
        path.resolve('.env'),
      ],
      validate: validateStreamingEnv,
      isGlobal: true,
    }),
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
  controllers: [StreamingController],
  providers: [
    StreamingService,
    QueueService,
    S3Service,
    R2StorageService,
    ContentVideoService,
  ],
})
export class StreamingModule {}
