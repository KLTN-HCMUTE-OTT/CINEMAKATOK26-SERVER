import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class WatchListService {
  constructor(
    @Inject('USER_ACTIVITY_SERVICE')
    private readonly userActivityClient: ClientProxy,
  ) {}

  addToWatchList(userId: string, contentId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watchlist.add' }, { userId, contentId })
      .pipe(catchRpcError());
  }

  removeFromWatchList(userId: string, contentId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watchlist.remove' }, { userId, contentId })
      .pipe(catchRpcError());
  }

  getUserWatchList(
    userId: string,
    query: Record<string, any>,
  ): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watchlist.list' }, { userId, query })
      .pipe(catchRpcError());
  }

  checkInWatchList(userId: string, contentId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watchlist.check' }, { userId, contentId })
      .pipe(catchRpcError());
  }

  checkInWatchListByMovieId(
    userId: string,
    movieOrSeriesId: string,
    type: 'MOVIE' | 'TVSERIES',
  ): Observable<any> {
    return this.userActivityClient
      .send(
        { cmd: 'activity.watchlist.check-entity' },
        { userId, movieOrSeriesId, type },
      )
      .pipe(catchRpcError());
  }

  getFavouriteCount(contentId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watchlist.count' }, { contentId })
      .pipe(catchRpcError());
  }
}
