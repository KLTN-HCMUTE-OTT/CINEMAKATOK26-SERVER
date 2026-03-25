import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class WatchProgressService {
  constructor(
    @Inject('USER_ACTIVITY_SERVICE')
    private readonly userActivityClient: ClientProxy,
  ) {}

  upsertWatchProgress(
    userId: string,
    payload: Record<string, any>,
  ): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.upsert' }, { userId, ...payload })
      .pipe(catchRpcError());
  }

  updateWatchProgress(
    userId: string,
    videoId: string,
    payload: Record<string, any>,
  ): Observable<any> {
    return this.userActivityClient
      .send(
        { cmd: 'activity.watch-progress.update' },
        { userId, videoId, ...payload },
      )
      .pipe(catchRpcError());
  }

  getResumeData(userId: string, videoId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.resume' }, { userId, videoId })
      .pipe(catchRpcError());
  }

  getWatchProgress(userId: string, videoId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.get-one' }, { userId, videoId })
      .pipe(catchRpcError());
  }

  getWatchProgressByUser(
    userId: string,
    query: Record<string, any>,
  ): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.get-all' }, { userId, query })
      .pipe(catchRpcError());
  }

  getWatchHistory(userId: string, query: Record<string, any>): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.history' }, { userId, query })
      .pipe(catchRpcError());
  }

  getRecentlyWatched(userId: string, limit = 10): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.recent' }, { userId, limit })
      .pipe(catchRpcError());
  }

  markAsCompleted(userId: string, videoId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.complete' }, { userId, videoId })
      .pipe(catchRpcError());
  }

  deleteWatchProgress(userId: string, videoId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.watch-progress.delete' }, { userId, videoId })
      .pipe(catchRpcError());
  }
}
