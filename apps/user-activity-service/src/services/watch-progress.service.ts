import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';

import { EntityWatchProgress } from '../entities/watch-progress.entity';

interface UpsertWatchProgressPayload {
  userId: string;
  videoId: string;
  watchedDuration: number;
}

interface UpdateWatchProgressPayload {
  userId: string;
  videoId: string;
  watchedDuration?: number;
  isCompleted?: boolean;
}

interface GetWatchProgressPayload {
  userId: string;
  videoId: string;
}

interface DeleteWatchProgressPayload {
  userId: string;
  videoId: string;
}

interface WatchProgressQuery extends PaginationQueryDto {
  isCompleted?: boolean | string;
}

interface GetWatchProgressByUserPayload {
  userId: string;
  query: WatchProgressQuery;
}

@Injectable()
export class WatchProgressService {
  constructor(
    @InjectRepository(EntityWatchProgress, 'activity')
    private readonly watchProgressRepository: Repository<EntityWatchProgress>,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
  ) {}

  private parseBoolean(
    value: boolean | string | undefined,
  ): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return undefined;
  }

  private async getVideo(videoId: string): Promise<Record<string, any>> {
    try {
      const video = await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getVideoById' },
          { id: videoId },
        ),
      );

      if (!video) {
        throw new NotFoundException({
          message: `Video not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }

      return video;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new NotFoundException({
        message: `Video not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
  }

  private async getOwnerInfo(
    videoId: string,
  ): Promise<Record<string, any> | null> {
    try {
      return await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getMovieOrSeriesFromVideo' },
          { videoId },
        ),
      );
    } catch {
      return null;
    }
  }

  private async enrichItem(item: EntityWatchProgress) {
    const [video, ownerInfo] = await Promise.all([
      this.getVideo(item.videoId),
      this.getOwnerInfo(item.videoId),
    ]);

    return {
      ...item,
      video,
      movieId: ownerInfo?.movieId ?? null,
      tvSeriesId: ownerInfo?.tvSeriesId ?? null,
      episodeId: ownerInfo?.episodeId ?? null,
      contentTitle: video?.videoUrl ?? null,
      contentThumbnail: video?.thumbnailUrl ?? null,
    };
  }

  async upsertWatchProgress(payload: UpsertWatchProgressPayload) {
    const { userId, videoId, watchedDuration } = payload;

    if (watchedDuration < 0) {
      throw new BadRequestException({
        message: 'watchedDuration must be greater than or equal to 0',
        code: ERROR_CODE.INVALID_BODY,
      });
    }

    await this.getVideo(videoId);

    let watchProgress = await this.watchProgressRepository.findOne({
      where: { userId, videoId },
    });

    if (!watchProgress) {
      watchProgress = this.watchProgressRepository.create({
        userId,
        videoId,
        watchedDuration,
        lastWatched: new Date(),
        isCompleted: false,
      });
    } else {
      watchProgress.watchedDuration = watchedDuration;
      watchProgress.lastWatched = new Date();
    }

    return this.watchProgressRepository.save(watchProgress);
  }

  async updateWatchProgress(payload: UpdateWatchProgressPayload) {
    const { userId, videoId, watchedDuration, isCompleted } = payload;

    const watchProgress = await this.watchProgressRepository.findOne({
      where: { userId, videoId },
    });

    if (!watchProgress) {
      throw new NotFoundException({
        message: `Watch progress for video ${videoId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    if (watchedDuration !== undefined) {
      if (watchedDuration < 0) {
        throw new BadRequestException({
          message: 'watchedDuration must be greater than or equal to 0',
          code: ERROR_CODE.INVALID_BODY,
        });
      }
      watchProgress.watchedDuration = watchedDuration;
    }

    if (isCompleted !== undefined) {
      watchProgress.isCompleted = isCompleted;
    }

    watchProgress.lastWatched = new Date();

    return this.watchProgressRepository.save(watchProgress);
  }

  async getWatchProgress(payload: GetWatchProgressPayload) {
    const { userId, videoId } = payload;

    const watchProgress = await this.watchProgressRepository.findOne({
      where: { userId, videoId },
    });

    if (!watchProgress) {
      throw new NotFoundException({
        message: `Watch progress for video ${videoId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    return this.enrichItem(watchProgress);
  }

  async getResumeData(payload: GetWatchProgressPayload) {
    const { userId, videoId } = payload;

    const watchProgress = await this.watchProgressRepository.findOne({
      where: { userId, videoId },
    });

    if (!watchProgress) {
      return null;
    }

    const video = await this.getVideo(videoId);
    return {
      videoId,
      contentTitle: video?.videoUrl ?? null,
      contentThumbnail: video?.thumbnailUrl ?? null,
      watchedDuration: watchProgress.watchedDuration,
      lastWatched: watchProgress.lastWatched,
      isCompleted: watchProgress.isCompleted,
    };
  }

  async getWatchProgressByUser(payload: GetWatchProgressByUserPayload) {
    const { userId, query } = payload;
    const { page = 1, limit = 10, sort } = query || {};

    const queryBuilder = this.watchProgressRepository
      .createQueryBuilder('wp')
      .where('wp.user_id = :userId', { userId });

    const isCompleted = this.parseBoolean(query?.isCompleted);
    if (isCompleted !== undefined) {
      queryBuilder.andWhere('wp.is_completed = :isCompleted', { isCompleted });
    }

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.entries(sortObj).forEach(([key, order]) => {
        queryBuilder.addOrderBy(`wp.${key}`, order as 'ASC' | 'DESC');
      });
    } else {
      queryBuilder.orderBy('wp.last_watched', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const enriched = await Promise.all(
      data.map((item) => this.enrichItem(item)),
    );

    return { data: enriched, total };
  }

  async getWatchHistory(payload: GetWatchProgressByUserPayload) {
    const { userId, query } = payload;
    const { page = 1, limit = 10, sort } = query || {};

    const queryBuilder = this.watchProgressRepository
      .createQueryBuilder('wp')
      .where('wp.user_id = :userId', { userId })
      .andWhere('wp.last_watched IS NOT NULL');

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.entries(sortObj).forEach(([key, order]) => {
        queryBuilder.addOrderBy(`wp.${key}`, order as 'ASC' | 'DESC');
      });
    } else {
      queryBuilder.orderBy('wp.last_watched', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const enriched = await Promise.all(
      data.map((item) => this.enrichItem(item)),
    );

    return { data: enriched, total };
  }

  async getRecentlyWatched(payload: { userId: string; limit?: number }) {
    const { userId, limit = 10 } = payload;

    const watchProgress = await this.watchProgressRepository
      .createQueryBuilder('wp')
      .where('wp.user_id = :userId', { userId })
      .andWhere('wp.last_watched IS NOT NULL')
      .orderBy('wp.last_watched', 'DESC')
      .take(limit)
      .getMany();

    return Promise.all(watchProgress.map((item) => this.enrichItem(item)));
  }

  async markAsCompleted(payload: GetWatchProgressPayload) {
    const { userId, videoId } = payload;

    const watchProgress = await this.watchProgressRepository.findOne({
      where: { userId, videoId },
    });

    if (!watchProgress) {
      throw new NotFoundException({
        message: `Watch progress for video ${videoId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    watchProgress.isCompleted = true;
    watchProgress.lastWatched = new Date();

    return this.watchProgressRepository.save(watchProgress);
  }

  async deleteWatchProgress(payload: DeleteWatchProgressPayload) {
    const { userId, videoId } = payload;

    const watchProgress = await this.watchProgressRepository.findOne({
      where: { userId, videoId },
    });

    if (!watchProgress) {
      throw new NotFoundException({
        message: `Watch progress for video ${videoId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    await this.watchProgressRepository.delete({ userId, videoId });

    return { message: 'Watch progress deleted successfully' };
  }
}
