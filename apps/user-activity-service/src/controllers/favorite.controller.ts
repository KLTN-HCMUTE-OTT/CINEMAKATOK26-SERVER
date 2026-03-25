import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { FavoriteService } from '../services/favorite.service';

@Controller()
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @MessagePattern({ cmd: 'activity.favorite.create' })
  createFavorite(@Payload() payload: { contentId: string; userId: string }) {
    return this.favoriteService.createFavorite(
      payload.contentId,
      payload.userId,
    );
  }

  @MessagePattern({ cmd: 'activity.favorite.list' })
  getFavorites(@Payload() payload: { userId: string }) {
    return this.favoriteService.getUserFavorites(payload.userId);
  }

  @MessagePattern({ cmd: 'activity.favorite.status' })
  getFavoriteStatus(
    @Payload() payload: { contentId: string; userId?: string },
  ) {
    return this.favoriteService.getFavoriteStatus(
      payload.contentId,
      payload.userId,
    );
  }

  @MessagePattern({ cmd: 'activity.favorite.remove' })
  removeFavorite(@Payload() payload: { contentId: string; userId: string }) {
    return this.favoriteService.removeFavorite(
      payload.contentId,
      payload.userId,
    );
  }

  @MessagePattern({ cmd: 'activity.favorite.remove-many' })
  removeArrayFavorite(
    @Payload() payload: { contentIds: string[]; userId: string },
  ) {
    return this.favoriteService.removeArrayFavorite(
      payload.contentIds,
      payload.userId,
    );
  }
}
