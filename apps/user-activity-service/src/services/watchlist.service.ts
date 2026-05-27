import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';

import { EntityWatchList } from '../entities/watchlist.entity';
import { AuditLogEmitterService } from './audit-log-emitter.service';
import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';

@Injectable()
export class WatchListService {
  constructor(
    @InjectRepository(EntityWatchList, 'activity')
    private readonly watchListRepository: Repository<EntityWatchList>,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    private readonly auditLogEmitter: AuditLogEmitterService,
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

  private async getContentIdFromEntity(
    entityId: string,
    type: 'MOVIE' | 'TVSERIES',
  ): Promise<string | null> {
    try {
      if (type === 'MOVIE') {
        const movie = await firstValueFrom(
          this.contentClient.send(
            { cmd: 'content.getMovieById' },
            { id: entityId },
          ),
        );
        return movie?.metaData?.id ?? null;
      }

      const tvSeries = await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getTvSeriesById' },
          { id: entityId },
        ),
      );
      return tvSeries?.metaData?.id ?? null;
    } catch {
      return null;
    }
  }

  private async getMovieDuration(movieId: string): Promise<number> {
    try {
      const movie = await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getMovieById' },
          { id: movieId },
        ),
      );
      return movie?.duration ?? 0;
    } catch {
      return 0;
    }
  }

  async addToWatchList(userId: string, contentId: string) {
    await this.getContent(contentId);

    const existing = await this.watchListRepository.findOne({
      where: { userId, contentId },
    });

    if (existing) {
      throw new ConflictException({
        message: 'Content already in watchlist',
        code: ERROR_CODE.ALREADY_EXISTS,
      });
    }

    const watchListItem = this.watchListRepository.create({
      userId,
      contentId,
    });
    const savedItem = await this.watchListRepository.save(watchListItem);

    // Emit audit log for watchlist add action
    try {
      const content = await this.getContent(contentId);
      const entityId = await this.getEntityIdByContentId(contentId);
      const isMovie = content?.type === 'MOVIE';
      this.auditLogEmitter.emitLog({
        userId,
        action: isMovie ? LOG_ACTION.ADD_MOVIE_TO_WATCHLIST : LOG_ACTION.ADD_SERIES_TO_WATCHLIST,
        resourceType: isMovie ? RESOURCE_TYPE.MOVIE : RESOURCE_TYPE.SERIES,
        resourceId: entityId ?? undefined,
        metadata: { contentId },
      });
    } catch {
      // Content resolution failure should not block the watchlist response
    }

    return savedItem;
  }

  async removeFromWatchList(userId: string, contentId: string): Promise<boolean> {
    const watchListItem = await this.watchListRepository.findOne({
      where: { userId, contentId },
    });

    if (!watchListItem) {
      throw new NotFoundException({
        message: 'Content not found in watchlist',
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    await this.watchListRepository.remove(watchListItem);

    // Emit audit log for watchlist remove action
    try {
      const content = await this.getContent(contentId);
      const entityId = await this.getEntityIdByContentId(contentId);
      const isMovie = content?.type === 'MOVIE';
      this.auditLogEmitter.emitLog({
        userId,
        action: isMovie ? LOG_ACTION.REMOVE_MOVIE_FROM_WATCHLIST : LOG_ACTION.REMOVE_SERIES_FROM_WATCHLIST,
        resourceType: isMovie ? RESOURCE_TYPE.MOVIE : RESOURCE_TYPE.SERIES,
        resourceId: entityId ?? undefined,
        metadata: { contentId },
      });
    } catch {
      // Content resolution failure should not block the remove response
    }

    return true;
  }

  async getUserWatchList(userId: string, query?: any): Promise<any> {
    const { page = 1, limit = 10 } = query || {};

    const queryBuilder = this.watchListRepository
      .createQueryBuilder('watchlist')
      .where('watchlist.user_id = :userId', { userId })
      .orderBy('watchlist.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const transformedData = await Promise.all(
      data.map(async (item) => {
        const content = await this.getContent(item.contentId);
        const entityId = await this.getEntityIdByContentId(item.contentId);
        const duration =
          content?.type === 'MOVIE' && entityId
            ? await this.getMovieDuration(entityId)
            : 0;

        return {
          id: item.id,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          content: {
            id: entityId,
            contentId: item.contentId,
            type: content?.type,
            title: content?.title,
            description: content?.description,
            thumbnail: content?.thumbnail,
            releaseDate: content?.releaseDate,
            trailer: content?.trailer,
            maturityRating: content?.maturityRating,
            categories: Array.isArray(content?.categories)
              ? content.categories.map((c: any) => c.categoryName)
              : [],
            duration,
          },
        };
      }),
    );

    return { data: transformedData, total };
  }

  async isInWatchList(userId: string, contentId: string): Promise<boolean> {
    const count = await this.watchListRepository.count({
      where: { userId, contentId },
    });

    return count > 0;
  }

  async isInWatchListByMovieId(
    userId: string,
    movieOrSeriesId: string,
    type: 'MOVIE' | 'TVSERIES',
  ): Promise<boolean> {
    const contentId = await this.getContentIdFromEntity(movieOrSeriesId, type);

    if (!contentId) {
      return false;
    }

    return this.isInWatchList(userId, contentId);
  }

  async getFavouriteCount(contentId: string): Promise<number> {
    return this.watchListRepository.count({
      where: { contentId },
    });
  }
}
