import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/core/database/database.module';

import { validateUserActivityEnv } from './config/env.schema';
import { FavoriteController } from './controllers/favorite.controller';
import { WatchProgressController } from './controllers/watch-progress.controller';
import { WatchListController } from './controllers/watchlist.controller';
import { ReviewController } from './controllers/review.controller';
import { EpisodeReviewController } from './controllers/episode-review.controller';
import { ReviewReplyController } from './controllers/review-reply.controller';
import { ReportController } from './controllers/report.controller';

import { EntityFavorite } from './entities/favorite.entity';
import { EntityWatchProgress } from './entities/watch-progress.entity';
import { EntityWatchList } from './entities/watchlist.entity';
import { EntityReview } from './entities/review.entity';
import { EntityReviewEpisode } from './entities/review-episode.entity';
import { EntityReviewReply } from './entities/review-reply.entity';
import { EntityReport } from './entities/report.entity';

import { FavoriteService } from './services/favorite.service';
import { WatchProgressService } from './services/watch-progress.service';
import { WatchListService } from './services/watchlist.service';
import { ReviewService } from './services/review.service';
import { EpisodeReviewService } from './services/episode-review.service';
import { ReviewReplyService } from './services/review-reply.service';
import { ReportService } from './services/report.service';
import { ConfigService } from '@nestjs/config';
import { AuditLogEmitterService } from './services/audit-log-emitter.service';

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
    TypeOrmModule.forFeature(
      [
        EntityWatchProgress,
        EntityFavorite,
        EntityWatchList,
        EntityReview,
        EntityReviewEpisode,
        EntityReviewReply,
        EntityReport,
      ],
      'activity',
    ),
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
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.AUTH_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.AUTH_SERVICE_PORT ?? 3001),
        },
      },
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.USER_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.USER_SERVICE_PORT ?? 3002),
        },
      },
    ]),
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'AUDIT_LOG_SERVICE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: 'audit_log_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [
    WatchProgressController,
    FavoriteController,
    WatchListController,
    ReviewController,
    EpisodeReviewController,
    ReviewReplyController,
    ReportController,
  ],
  providers: [
    WatchProgressService,
    FavoriteService,
    WatchListService,
    ReviewService,
    EpisodeReviewService,
    ReviewReplyService,
    ReportService,
    AuditLogEmitterService,
  ],
})
export class UserActivityModule {}
