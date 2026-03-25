import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class FavoriteService {
  constructor(
    @Inject('USER_ACTIVITY_SERVICE')
    private readonly userActivityClient: ClientProxy,
  ) {}

  createFavorite(contentId: string, userId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.favorite.create' }, { contentId, userId })
      .pipe(catchRpcError());
  }

  getFavorites(userId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.favorite.list' }, { userId })
      .pipe(catchRpcError());
  }

  getFavoriteStatus(contentId: string, userId?: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.favorite.status' }, { contentId, userId })
      .pipe(catchRpcError());
  }

  removeFavorite(contentId: string, userId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.favorite.remove' }, { contentId, userId })
      .pipe(catchRpcError());
  }

  removeArrayFavorite(contentIds: string[], userId: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.favorite.remove-many' }, { contentIds, userId })
      .pipe(catchRpcError());
  }
}
