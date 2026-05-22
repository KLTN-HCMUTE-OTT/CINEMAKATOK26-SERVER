import { firstValueFrom } from 'rxjs';
import { Repository, EntityManager } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { ERROR_CODE } from '@app/common/constants/global.constants';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { ForbiddenException, Injectable, NotFoundException, Inject, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateReviewDto, UpdateReviewDto } from '@app/common/dtos/user-activity/review.dto';
import { EntityReview } from '../entities/review.entity';
import { ContentNotFoundError, CreateReviewFailedError, DomainError, ReviewNotFoundError, UpdateReviewFailedError, DeleteReviewFailedError } from '@app/common/exceptions/domain.error';
import { AuditLogEmitterService } from './audit-log-emitter.service';
import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(EntityReview, 'activity')
    private readonly reviewRepository: Repository<EntityReview>,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    private readonly auditLogEmitter: AuditLogEmitterService,
  ) {}

  private async getEntityIdByContentId(contentId: string): Promise<string | null> {
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

  async createReview(userId: string, createReviewDto: CreateReviewDto) {
    const queryRunner = this.reviewRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const content = await firstValueFrom(this.contentClient.send({ cmd: 'content.getContentById' }, { id: createReviewDto.contentId }));
      if (!content) {
        throw new NotFoundException({ message: `Content not found`, code: ERROR_CODE.ENTITY_NOT_FOUND });
      }

      const review = this.reviewRepository.create({
        ...createReviewDto,
        userId,
        contentId: content.id,
      });
      const savedReview = await queryRunner.manager.save(review);

      await this.calculateAndBroadcastContentRating(queryRunner.manager, content.id);

      await queryRunner.commitTransaction();

      // Emit audit log after successful commit
      const isMovie = content?.type === 'MOVIE';
      const entityId = await this.getEntityIdByContentId(content.id);
      this.auditLogEmitter.emitLog({
        userId,
        action: LOG_ACTION.CREATE_REVIEW,
        resourceType: isMovie ? RESOURCE_TYPE.MOVIE : RESOURCE_TYPE.SERIES,
        resourceId: entityId ?? undefined,
        metadata: { contentId: content.id, reviewId: savedReview.id },
      });

      return this.findReviewById(savedReview.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new CreateReviewFailedError();
    } finally {
      await queryRunner.release();
    }
  }

  async updateReview(id: string, updateReviewDto: UpdateReviewDto, userId?: string) {
    const queryRunner = this.reviewRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const review = await this.findReviewById(id);

      if (userId && review.userId !== userId) {
        throw new ForbiddenException({ message: 'You are not authorized to update this review', code: ERROR_CODE.UNAUTHORIZED });
      }

      Object.assign(review, updateReviewDto);
      const updatedReview = await queryRunner.manager.save(review);

      await this.calculateAndBroadcastContentRating(queryRunner.manager, review.contentId).catch(() => {});

      await queryRunner.commitTransaction();

      // Emit audit log after successful commit
      try {
        const content = await firstValueFrom(this.contentClient.send({ cmd: 'content.getContentById' }, { id: review.contentId }));
        const isMovie = content?.type === 'MOVIE';
        const entityId = await this.getEntityIdByContentId(review.contentId);
        this.auditLogEmitter.emitLog({
          userId: userId ?? review.userId,
          action: LOG_ACTION.UPDATE_REVIEW,
          resourceType: isMovie ? RESOURCE_TYPE.MOVIE : RESOURCE_TYPE.SERIES,
          resourceId: entityId ?? undefined,
          metadata: { contentId: review.contentId, reviewId: id },
        });
      } catch {
        // Content resolution failure should not block the update response
      }

      return this.findReviewById(updatedReview.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof DomainError || error instanceof HttpException || (error as any).code) {
        throw error;
      }
      throw new UpdateReviewFailedError();
    } finally {
      await queryRunner.release();
    }
  }

  async deleteReview(id: string, userId?: string) {
    const queryRunner = this.reviewRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const review = await this.findReviewById(id);

      if (userId && review.userId !== userId) {
        throw new ForbiddenException({ message: 'You are not authorized to delete this review', code: ERROR_CODE.UNAUTHORIZED });
      }

      const contentId = review.contentId;
      await queryRunner.manager.delete(EntityReview, id);

      await this.calculateAndBroadcastContentRating(queryRunner.manager, contentId);

      await queryRunner.commitTransaction();

      // Emit audit log after successful commit
      try {
        const content = await firstValueFrom(this.contentClient.send({ cmd: 'content.getContentById' }, { id: contentId }));
        const isMovie = content?.type === 'MOVIE';
        const entityId = await this.getEntityIdByContentId(contentId);
        this.auditLogEmitter.emitLog({
          userId: userId ?? review.userId,
          action: LOG_ACTION.DELETE_REVIEW,
          resourceType: isMovie ? RESOURCE_TYPE.MOVIE : RESOURCE_TYPE.SERIES,
          resourceId: entityId ?? undefined,
          metadata: { contentId, reviewId: id },
        });
      } catch {
        // Content resolution failure should not block the delete response
      }

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof DomainError || error instanceof HttpException || (error as any).code) {
        throw error;
      }
      throw new DeleteReviewFailedError();
    } finally {
      await queryRunner.release();
    }
  }

  async findReviewById(id: string) {
    const review = await this.reviewRepository.findOne({ where: { id } });
    if (!review) {
      throw new ReviewNotFoundError();
    }
    return review;
  }

  async findReviews(query: PaginationQueryDto & { contentId?: string; userId?: string }) {
    const { page = 1, limit = 10, sort, search, contentId, userId, status } = query || {};

    const queryBuilder = this.reviewRepository.createQueryBuilder('review');

    const statusFilter = status || REVIEW_STATUS.ACTIVE;
    queryBuilder.andWhere('review.status = :status', { status: statusFilter });

    if (contentId) queryBuilder.andWhere('review.contentId = :contentId', { contentId });
    if (userId) queryBuilder.andWhere('review.userId = :userId', { userId });
    if (search) queryBuilder.andWhere('review.contentReviewed ILIKE :search', { search: `%${search}%` });

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
    const review = await this.reviewRepository.findOne({ where: { id: reviewId }, select: ['userId'] });
    if (!review) {
      throw new ReviewNotFoundError();
    }
    return review.userId === userId;
  }

  /**
   * Calculates the average rating for a content item and broadcasts it to the content service.
   * Extracts duplicated logic from create, update, and delete methods to adhere to DRY principles.
   */
  private async calculateAndBroadcastContentRating(manager: EntityManager, contentId: string): Promise<void> {
    const ratingStats = await manager
      .createQueryBuilder(EntityReview, 'review')
      .select('AVG(review.rating)', 'avgRating')
      .where('review.contentId = :contentId', { contentId })
      .getRawOne();

    const newAvgRating = parseFloat(ratingStats.avgRating) || 0;
    await this.contentClient.send({ cmd: 'content.updateContent' }, { id: contentId, data: { avgRating: newAvgRating } }).toPromise();
  }
}
