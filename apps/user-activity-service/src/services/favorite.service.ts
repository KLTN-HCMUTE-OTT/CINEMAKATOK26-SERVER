import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';

import { EntityFavorite } from '../entities/favorite.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(EntityFavorite, 'activity')
    private readonly favoriteRepository: Repository<EntityFavorite>,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
  ) {}

  private async getContent(contentId: string): Promise<any> {
    try {
      const content = await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getContentById' },
          { id: contentId },
        ),
      );

      if (!content) {
        throw new NotFoundException({
          message: `Content not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }

      return content;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new NotFoundException({
        message: `Content not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
  }

  private async getEntityIdByContentId(
    contentId: string,
  ): Promise<string | null> {
    try {
      return await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getEntityIdByContentId' },
          { contentId },
        ),
      );
    } catch {
      return null;
    }
  }

  private async getMovieDuration(movieId: string): Promise<number | null> {
    try {
      const movie = await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getMovieById' },
          { id: movieId },
        ),
      );
      return movie?.duration ?? null;
    } catch {
      return null;
    }
  }

  async createFavorite(contentId: string, userId: string) {
    await this.getContent(contentId);

    const existingFavorite = await this.favoriteRepository.findOne({
      where: { userId, contentId },
    });

    if (existingFavorite) {
      throw new BadRequestException({
        message: 'Content already in favorites',
        code: ERROR_CODE.ALREADY_EXISTS,
      });
    }

    const favorite = this.favoriteRepository.create({ userId, contentId });
    await this.favoriteRepository.save(favorite);

    return this.getFavoriteStatus(contentId, userId);
  }

  async getFavoriteStatus(contentId: string, userId?: string) {
    await this.getContent(contentId);

    const totalFavorites = await this.favoriteRepository.count({
      where: { contentId },
    });

    if (!userId) {
      return {
        totalFavorites,
        isFavorited: false,
      };
    }

    const userFavorite = await this.favoriteRepository.findOne({
      where: { userId, contentId },
    });

    return {
      totalFavorites,
      isFavorited: !!userFavorite,
    };
  }

  async removeFavorite(contentId: string, userId: string) {
    const favorite = await this.favoriteRepository.findOne({
      where: { userId, contentId },
    });

    if (!favorite) {
      throw new NotFoundException({
        message: 'Favorite not found',
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    await this.favoriteRepository.remove(favorite);

    return { message: 'Content removed from favorites successfully' };
  }

  async removeArrayFavorite(contentIds: string[], userId: string) {
    for (const contentId of contentIds) {
      const favorite = await this.favoriteRepository.findOne({
        where: { userId, contentId },
      });
      if (!favorite) {
        throw new NotFoundException({
          message: `Favorite with content ID ${contentId} not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }
      await this.favoriteRepository.remove(favorite);
    }

    return { message: 'Contents removed from favorites successfully' };
  }

  async getUserFavorites(userId: string) {
    const favorites = await this.favoriteRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const result = await Promise.all(
      favorites.map(async (fav) => {
        const content = await this.getContent(fav.contentId);
        const entityId = await this.getEntityIdByContentId(fav.contentId);

        const isMovie = content?.type === 'MOVIE';
        const movieId = isMovie ? entityId : null;
        const tvSeriesId = isMovie ? null : entityId;

        return {
          id: content.id,
          movieId,
          tvSeriesId,
          title: content.title,
          type: content.type,
          releaseDate: content.releaseDate,
          thumbnail: content.thumbnail,
          banner: content.banner ?? null,
          trailer: content.trailer,
          duration: movieId ? await this.getMovieDuration(movieId) : null,
        };
      }),
    );

    return result;
  }
}
