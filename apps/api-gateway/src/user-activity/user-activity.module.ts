import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { FavoriteController } from './controllers/favorite.controller';
import { WatchProgressController } from './controllers/watch-progress.controller';
import { WatchListController } from './controllers/watchlist.controller';
import { FavoriteService } from './services/favorite.service';
import { WatchProgressService } from './services/watch-progress.service';
import { WatchListService } from './services/watchlist.service';
import { ReviewController } from './controllers/review.controller';
import { ReviewService } from './services/review.service';
import { EpisodeReviewController } from './controllers/episode-review.controller';
import { EpisodeReviewService } from './services/episode-review.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_ACTIVITY_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.USER_ACTIVITY_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.USER_ACTIVITY_SERVICE_PORT ?? 3007),
        },
      },
    ]),
  ],
  controllers: [
    WatchProgressController,
    FavoriteController,
    WatchListController,
    ReviewController,
    EpisodeReviewController,
  ],
  providers: [
    WatchProgressService,
    FavoriteService,
    WatchListService,
    ReviewService,
    EpisodeReviewService,
  ],
  exports: [
    WatchProgressService,
    FavoriteService,
    WatchListService,
    ReviewService,
  ],
})
export class UserActivityModule {}
