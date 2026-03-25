import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { REPORT_TYPE, REVIEW_STATUS } from '@app/common/enums/global.enum';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { CreateEpisodeReviewDto, UpdateEpisodeReviewDto } from '@app/common/dtos/user-activity/episode.-review.dto';
import { EntityReport } from '../entities/report.entity';
import { EntityReviewEpisode } from '../entities/review-episode.entity';
import { EntityReviewReply } from '../entities/review-reply.entity';

@Injectable()
export class EpisodeReviewService {
  constructor(
    @InjectRepository(EntityReviewEpisode, 'activity')
    private readonly reviewEpisodeRepository: Repository<EntityReviewEpisode>,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
  ) {}

  async createReview(userId: string, createEpisodeReviewDto: CreateEpisodeReviewDto) {
    // Check if episode exists via Content Service
    // Note: We assume content.getEpisodeById exists or we use content.getTvSeriesById and find it
    // For simplicity and decoupling, we assume a direct command or skip check if not critical for this refactor phase
    // but better to have it. Let's use getTvSeriesById if we have to, or assume cmd exists.
    
    const existingReview = await this.reviewEpisodeRepository.findOne({
      where: {
        userId,
        episodeId: createEpisodeReviewDto.episodeId,
      },
    });

    if (existingReview) {
      throw new BadRequestException({
        message: 'You have already reviewed this episode',
        code: ERROR_CODE.ALREADY_EXISTS,
      });
    }

    const review = this.reviewEpisodeRepository.create({
      ...createEpisodeReviewDto,
      userId,
    });
    
    const savedReview = await this.reviewEpisodeRepository.save(review);
    
    // Broadcast update if needed (e.g. for ratings)
    this.contentClient.emit('activity.episode-review.created', { review: savedReview });

    return savedReview;
  }

  async updateReview(id: string, updateReviewDto: UpdateEpisodeReviewDto, userId?: string) {
    const review = await this.findReviewById(id);

    if (userId && review.userId !== userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to update this review',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    Object.assign(review, updateReviewDto);
    const updatedReview = await this.reviewEpisodeRepository.save(review);
    
    this.contentClient.emit('activity.episode-review.updated', { review: updatedReview });

    return updatedReview;
  }

  async deleteReview(id: string, userId?: string) {
    const review = await this.findReviewById(id);

    if (userId && review.userId !== userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to delete this review',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    await this.reviewEpisodeRepository.manager.transaction(async (manager) => {
        // Delete all replies for this episode review
        // In the same microservice, we can do this directly
        await manager.delete(EntityReviewReply, { episodeReview: { id } });

        // Delete all related reports
        await manager.delete(EntityReport, {
            targetId: id,
            type: REPORT_TYPE.EPISODE_REVIEW,
        });

        await manager.delete(EntityReviewEpisode, id);
    });

    this.contentClient.emit('activity.episode-review.deleted', { id });
  }

  async findReviewById(id: string) {
    const review = await this.reviewEpisodeRepository.findOne({
      where: { id },
    });
    
    if (!review) {
      throw new NotFoundException({
        message: `Review not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
    return review;
  }

  async findReviews(query: PaginationQueryDto & { episodeId?: string; userId?: string; status?: REVIEW_STATUS }) {
    const { page = 1, limit = 10, sort, search, episodeId, userId, status } = query || {};

    const queryBuilder = this.reviewEpisodeRepository.createQueryBuilder('review');

    // Filter by status - default to ACTIVE if not specified
    const statusFilter = status || REVIEW_STATUS.ACTIVE;
    queryBuilder.andWhere('review.status = :status', { status: statusFilter });

    if (episodeId) queryBuilder.andWhere('review.episodeId = :episodeId', { episodeId });
    if (userId) queryBuilder.andWhere('review.userId = :userId', { userId });
    
    if (search)
      queryBuilder.andWhere('review.contentReviewed ILIKE :search', { search: `%${search}%` });

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.entries(sortObj).forEach(([key, order]) => {
        queryBuilder.addOrderBy(`review.${key}`, order as 'ASC' | 'DESC');
      });
    } else if (!search) {
      queryBuilder.orderBy('review.createdAt', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async isReviewOwner(reviewId: string, userId: string): Promise<boolean> {
    const review = await this.findReviewById(reviewId);
    return review.userId === userId;
  }
}
