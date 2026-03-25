import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { WatchListService } from '../services/watchlist.service';

@Controller()
export class WatchListController {
  constructor(private readonly watchListService: WatchListService) {}

  @MessagePattern({ cmd: 'activity.watchlist.add' })
  addToWatchList(@Payload() payload: { userId: string; contentId: string }) {
    return this.watchListService.addToWatchList(
      payload.userId,
      payload.contentId,
    );
  }

  @MessagePattern({ cmd: 'activity.watchlist.remove' })
  removeFromWatchList(
    @Payload() payload: { userId: string; contentId: string },
  ) {
    return this.watchListService.removeFromWatchList(
      payload.userId,
      payload.contentId,
    );
  }

  @MessagePattern({ cmd: 'activity.watchlist.list' })
  getUserWatchList(
    @Payload() payload: { userId: string; query: Record<string, any> },
  ) {
    return this.watchListService.getUserWatchList(
      payload.userId,
      payload.query,
    );
  }

  @MessagePattern({ cmd: 'activity.watchlist.check' })
  checkInWatchList(@Payload() payload: { userId: string; contentId: string }) {
    return this.watchListService.isInWatchList(
      payload.userId,
      payload.contentId,
    );
  }

  @MessagePattern({ cmd: 'activity.watchlist.check-entity' })
  checkInWatchListByMovieId(
    @Payload()
    payload: {
      userId: string;
      movieOrSeriesId: string;
      type: 'MOVIE' | 'TVSERIES';
    },
  ) {
    return this.watchListService.isInWatchListByMovieId(
      payload.userId,
      payload.movieOrSeriesId,
      payload.type,
    );
  }

  @MessagePattern({ cmd: 'activity.watchlist.count' })
  getFavouriteCount(@Payload() payload: { contentId: string }) {
    return this.watchListService.getFavouriteCount(payload.contentId);
  }
}
