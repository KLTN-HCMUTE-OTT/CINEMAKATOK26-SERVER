import { In, Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CreateVideoDto,
  UpdateVideoDto,
} from 'libs/common/src/dtos/content/video.dto';
import { EntityEpisode } from '../entities/tvseries.entity';
import { EntityVideo, VideoOwnerType } from '../entities/video.entity';

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(EntityVideo, 'content')
    private readonly videoRepository: Repository<EntityVideo>,
    @InjectRepository(EntityEpisode, 'content')
    private readonly episodeRepository: Repository<EntityEpisode>,
  ) {}

  async create(createDto: CreateVideoDto) {
    try {
      const video = this.videoRepository.create({
        videoUrl: createDto.videoUrl,
        status: createDto.status, // Will use default from entity if not provided
      });
      return await this.videoRepository.save(video);
    } catch (error) {
      throw new BadRequestException({
        code: ERROR_CODE.UNEXPECTED_ERROR,
        message: 'Failed to create video',
        error: error.message,
      });
    }
  }

  async findAll(query?: any) {
    const { page = 1, limit = 10, sort, search } = query || {};

    const queryBuilder = this.videoRepository.createQueryBuilder('video');

    if (search) {
      queryBuilder
        .where(`similarity(video.videoUrl, :search) > 0.2`)
        .setParameter('search', search)
        .addSelect(`similarity(video.videoUrl, :search)`, 'rank')
        .orderBy('rank', 'DESC');
    }

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.keys(sortObj).forEach((key) => {
        queryBuilder.addOrderBy(`video.${key}`, sortObj[key]);
      });
    } else if (!search) {
      queryBuilder.orderBy('video.createdAt', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string) {
    const video = await this.videoRepository.findOne({
      where: { id },
    });

    if (!video) {
      throw new NotFoundException({
        code: ERROR_CODE.ENTITY_NOT_FOUND,
        message: 'Video not found',
      });
    }

    return video;
  }

  async update(id: string, updateDto: UpdateVideoDto) {
    try {
      const video = await this.findOne(id);
      if (!video) {
        throw new NotFoundException({
          code: ERROR_CODE.ENTITY_NOT_FOUND,
          message: 'Video not found',
        });
      }

      const updateData: Partial<EntityVideo> = {};
      if (updateDto.videoUrl !== undefined)
        updateData.videoUrl = updateDto.videoUrl;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;
      if (updateDto.thumbnailUrl !== undefined)
        updateData.thumbnailUrl = updateDto.thumbnailUrl;
      if (updateDto.sprites !== undefined)
        updateData.sprites = updateDto.sprites;
      if (updateDto.vttFiles !== undefined)
        updateData.vttFiles = updateDto.vttFiles;
      if (updateDto.isViolent !== undefined)
        updateData.isViolent = updateDto.isViolent;
      if (updateDto.violenceScore !== undefined)
        updateData.violenceScore = updateDto.violenceScore;
      if (updateDto.violentSegments !== undefined)
        updateData.violentSegments = updateDto.violentSegments;
      if (updateDto.isNude !== undefined)
        updateData.isNude = updateDto.isNude;
      if (updateDto.nudityScore !== undefined)
        updateData.nudityScore = updateDto.nudityScore;
      if (updateDto.nuditySegments !== undefined)
        updateData.nuditySegments = updateDto.nuditySegments;

      Object.assign(video, updateData);

      return await this.videoRepository.save(video);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        code: ERROR_CODE.UNEXPECTED_ERROR,
        message: 'Failed to update video',
        error: error.message,
      });
    }
  }

  async delete(id: string) {
    const video = await this.findOne(id);
    if (!video) {
      throw new NotFoundException({
        code: ERROR_CODE.ENTITY_NOT_FOUND,
        message: 'Video not found',
      });
    }
    await this.videoRepository.remove(video);
  }
  async findByEpisodeIds(episodeIds: string[]): Promise<EntityVideo[]> {
    if (!episodeIds?.length) return [];

    return this.videoRepository.find({
      where: {
        ownerType: VideoOwnerType.EPISODE,
        ownerId: In(episodeIds),
      },
    });
  }

  async findByMovie(movieId: string): Promise<EntityVideo[]> {
    return this.videoRepository.find({
      where: {
        ownerType: VideoOwnerType.MOVIE,
        ownerId: movieId,
      },
    });
  }
  async validateVideos(videoIds: UpdateVideoDto[]): Promise<EntityVideo[]> {
    return this.videoRepository.find({
      where: { id: In(videoIds.map((v) => v.id)) },
    });
  }

  async assignVideos(
    videos: EntityVideo[],
    id: string,
    videoType?: VideoOwnerType,
  ) {
    await Promise.all(
      videos.map((v) =>
        this.videoRepository.update(v.id, {
          ownerType: videoType || VideoOwnerType.EPISODE,
          ownerId: id,
        }),
      ),
    );
  }

  async unassignVideosByEpisodeIds(episodeIds: string[]): Promise<void> {
    if (!episodeIds.length) {
      return;
    }

    await this.videoRepository.update(
      {
        ownerType: VideoOwnerType.EPISODE,
        ownerId: In(episodeIds),
      },
      {
        ownerType: null,
        ownerId: null,
      },
    );
  }

  async findByMovieIds(movieIds: string[]): Promise<EntityVideo[]> {
    if (!movieIds?.length) return [];

    return this.videoRepository.find({
      where: {
        ownerType: VideoOwnerType.MOVIE,
        ownerId: In(movieIds),
      },
    });
  }

  async unassignVideosByMovieIds(movieIds: string[]): Promise<void> {
    if (!movieIds.length) {
      return;
    }

    await this.videoRepository.update(
      {
        ownerType: VideoOwnerType.MOVIE,
        ownerId: In(movieIds),
      },
      {
        ownerType: null,
        ownerId: null,
      },
    );
  }
  /**
   * Tìm video theo ownerId và ownerType
   */
  async findByOwner(
    ownerId: string,
    ownerType: VideoOwnerType,
  ): Promise<EntityVideo | null> {
    return await this.videoRepository.findOne({
      where: {
        ownerId,
        ownerType,
      },
    });
  }

  async getMovieOrSeriesIdFromVideo(videoId: string) {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });
    if (!video) {
      throw new NotFoundException({
        message: `Video not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    if (video.ownerType === VideoOwnerType.MOVIE) {
      return { movieId: video.ownerId };
    } else if (video.ownerType === 'episode') {
      if (!video.ownerId) {
        throw new NotFoundException({
          message: `Episode ownerId is null for video`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }
      const episode = await this.episodeRepository.findOne({
        where: { id: video.ownerId },
        relations: ['season', 'season.tvseries'],
      });
      const tvSeriesId = episode?.season?.tvseries?.id;
      return { tvSeriesId };
    }
  }

  async getMovieOrSeriesFromVideo(
    videoId: string,
  ): Promise<{ movieId?: string; tvSeriesId?: string; episodeId?: string }> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });
    if (!video) {
      throw new NotFoundException({
        message: `Video with ID ${videoId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    if (video.ownerType === VideoOwnerType.MOVIE) {
      return { movieId: video.ownerId ?? undefined };
    } else if (video.ownerType === VideoOwnerType.EPISODE) {
      if (!video.ownerId) {
        throw new NotFoundException({
          message: `Episode ownerId is null for video`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }
      const episode = await this.episodeRepository.findOne({
        where: { id: video.ownerId },
        relations: ['season', 'season.tvseries'],
      });
      return {
        tvSeriesId: episode?.season?.tvseries?.id ?? undefined,
        episodeId: video.ownerId ?? undefined,
      };
    }

    throw new NotFoundException({
      message: `Video has unsupported ownerType`,
      code: ERROR_CODE.ENTITY_NOT_FOUND,
    });
  }
}
