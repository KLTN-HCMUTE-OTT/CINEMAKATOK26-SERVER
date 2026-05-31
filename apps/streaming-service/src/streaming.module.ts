import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';

import { DatabaseModule } from '@app/core/database/database.module';

import { validateStreamingEnv } from './config/env.schema';
import { EntityDrmKey } from './entities/drm-key.entity';
import { StreamingController } from './streaming.controller';
import { DrmLicenseService } from './services/drm-license.service';
import {
  ContentVideoService,
  DrmKeyService,
  QueueService,
  R2StorageService,
  S3Service,
  ShakaPackagerService,
  StreamingService,
  ViolenceDetectorService,
  NudityDetectorService,
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
    // Database connection for DRM keys
    DatabaseModule.forRoot({ service: 'streaming' }),
    TypeOrmModule.forFeature([EntityDrmKey], 'streaming'),
    // Microservice clients
    ClientsModule.register([
      {
        name: 'CONTENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.CONTENT_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.CONTENT_SERVICE_PORT ?? 3003),
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
      {
        name: 'AUDIT_LOG_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
          queue: 'audit_log_queue',
          queueOptions: { durable: true },
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
    DrmKeyService,
    DrmLicenseService,
    ShakaPackagerService,
    ViolenceDetectorService,
    NudityDetectorService,
  ],
})
export class StreamingModule {}
