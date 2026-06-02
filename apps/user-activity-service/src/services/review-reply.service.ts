import { firstValueFrom } from 'rxjs';
import { Repository, In } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { REPORT_TYPE, REVIEW_STATUS } from '@app/common/enums/global.enum';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { ForbiddenException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { CreateReviewReplyDto, UpdateReviewReplyDto } from '@app/common/dtos/user-activity/review-reply.dto';
import { EntityReport } from '../entities/report.entity';
import { EntityReviewEpisode } from '../entities/review-episode.entity';
import { EntityReviewReply } from '../entities/review-reply.entity';
import { EntityReview } from '../entities/review.entity';
import { ReviewReplyNotFoundError, ReviewNotFoundError, DeleteReviewReplyFailedError } from '@app/common/exceptions/domain.error';

@Injectable()
export class ReviewReplyService {
  constructor(
    @InjectRepository(EntityReviewReply, 'activity')
    private readonly reviewReplyRepository: Repository<EntityReviewReply>,
    @InjectRepository(EntityReview, 'activity')
    private readonly reviewRepository: Repository<EntityReview>,
    @InjectRepository(EntityReviewEpisode, 'activity')
    private readonly reviewEpisodeRepository: Repository<EntityReviewEpisode>,
    @InjectRepository(EntityReport, 'activity')
    private readonly reportRepository: Repository<EntityReport>,
    @Inject('USER_SERVICE')
    private readonly userClient: ClientProxy,
  ) {}

  private async enrichWithUserInfo(replies: EntityReviewReply[]): Promise<any[]> {
    if (replies.length === 0) return replies;
    const ids = [...new Set(replies.map((r) => r.userId))];
    let usersMap: Record<string, { name: string; avatar: string | null }> = {};
    try {
      const users: any[] = await firstValueFrom(
        this.userClient.send({ cmd: 'user.getUsersByIds' }, { ids }),
      );
      if (Array.isArray(users)) {
        users.forEach((u) => {
          usersMap[u.id] = { name: u.name, avatar: u.avatar ?? null };
        });
      }
    } catch {
      // fail silently
    }
    return replies.map((r) => ({
      ...r,
      user: usersMap[r.userId] ? { id: r.userId, ...usersMap[r.userId] } : undefined,
    }));
  }

  async createReply(userId: string, createReplyDto: CreateReviewReplyDto) {
    // Validate that exactly one of reviewId or episodeReviewId is provided
    const hasReviewId = !!createReplyDto.reviewId;
    const hasEpisodeReviewId = !!createReplyDto.episodeReviewId;

    if (!hasReviewId && !hasEpisodeReviewId) {
      throw new ForbiddenException({
        message: 'Either reviewId or episodeReviewId must be provided',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    if (hasReviewId && hasEpisodeReviewId) {
      throw new ForbiddenException({
        message: 'Cannot provide both reviewId and episodeReviewId',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    // Kiểm tra review hoặc episode review có tồn tại không
    if (hasReviewId) {
      const review = await this.reviewRepository.findOne({
        where: { id: createReplyDto.reviewId },
      });

      if (!review) {
        throw new NotFoundException({
          message: `Review not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }
    } else {
      const episodeReview = await this.reviewEpisodeRepository.findOne({
        where: { id: createReplyDto.episodeReviewId },
      });

      if (!episodeReview) {
        throw new NotFoundException({
          message: `Episode review not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }
    }

    // Nếu có parentReplyId, kiểm tra parent reply có tồn tại không
    if (createReplyDto.parentReplyId) {
      const parentReply = await this.reviewReplyRepository.findOne({
        where: { id: createReplyDto.parentReplyId },
        relations: ['review', 'episodeReview'],
      });

      if (!parentReply) {
        throw new NotFoundException({
          message: `Parent reply not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }

      // Đảm bảo parent reply thuộc cùng review hoặc episode review
      if (
        hasReviewId &&
        parentReply.review &&
        parentReply.review.id !== createReplyDto.reviewId
      ) {
        throw new ForbiddenException({
          message: 'Parent reply does not belong to the specified review',
          code: ERROR_CODE.UNAUTHORIZED,
        });
      }

      if (
        hasEpisodeReviewId &&
        parentReply.episodeReview &&
        parentReply.episodeReview.id !== createReplyDto.episodeReviewId
      ) {
        throw new ForbiddenException({
          message: 'Parent reply does not belong to the specified episode review',
          code: ERROR_CODE.UNAUTHORIZED,
        });
      }
    }

    const reply = this.reviewReplyRepository.create({
      content: createReplyDto.content,
      userId: userId,
      review: hasReviewId ? ({ id: createReplyDto.reviewId } as EntityReview) : null,
      episodeReview: hasEpisodeReviewId
        ? ({ id: createReplyDto.episodeReviewId } as EntityReviewEpisode)
        : null,
      parentReply: createReplyDto.parentReplyId
        ? ({ id: createReplyDto.parentReplyId } as EntityReviewReply)
        : null,
    });

    const savedReply = await this.reviewReplyRepository.save(reply);
    return this.findReplyById(savedReply.id);
  }

  async updateReply(id: string, updateReplyDto: UpdateReviewReplyDto, userId?: string) {
    const reply = await this.reviewReplyRepository.findOne({ where: { id } });
    if (!reply) throw new ReviewReplyNotFoundError();

    // Check ownership if userId is provided
    if (userId && reply.userId !== userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to update this reply',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    Object.assign(reply, updateReplyDto);
    const updatedReply = await this.reviewReplyRepository.save(reply);
    return this.findReplyById(updatedReply.id);
  }

  async deleteReply(id: string, userId?: string) {
    const queryRunner = this.reviewReplyRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log('Deleting reply id:', id);
      const reply = await this.reviewReplyRepository.findOne({ where: { id } });
      if (!reply) throw new ReviewReplyNotFoundError();

      // Check ownership if userId is provided
      if (userId && reply.userId !== userId) {
        throw new ForbiddenException({
          message: 'You are not authorized to delete this reply',
          code: ERROR_CODE.UNAUTHORIZED,
        });
      }

      // Collect all reply IDs (current + all descendants)
      const allReplyIds = await this.collectAllDescendantReplyIds(id, queryRunner);
      allReplyIds.push(id); // Add current reply

      // Delete all reports for all these replies in one query
      // Using queryRunner.manager.delete with an object is safer as it uses the entity mapping
      if (allReplyIds.length > 0) {
        await queryRunner.manager.delete(EntityReport, {
           targetId: In(allReplyIds),
           type: REPORT_TYPE.REVIEW_REPLY
        });
      }

      // Delete main reply - database CASCADE will handle childReplies
      await queryRunner.manager.delete(EntityReviewReply, id);

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      console.error('Error deleting review reply:', error);
      await queryRunner.rollbackTransaction();
      // If it's a known exception, re-throw it. Otherwise, throw generic fail.
      if (error instanceof ForbiddenException || error instanceof NotFoundException || (error as any).code) {
        throw error;
      }
      throw new DeleteReviewReplyFailedError(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Collect all descendant reply IDs recursively
   */
  private async collectAllDescendantReplyIds(
    parentReplyId: string,
    queryRunner: any,
  ): Promise<string[]> {
    const childReplies = await queryRunner.manager.find(EntityReviewReply, {
      where: { parentReply: { id: parentReplyId } },
      select: ['id'],
    });

    let allIds: string[] = childReplies.map(child => child.id);

    // Recursively collect descendants
    for (const child of childReplies) {
      const descendantIds = await this.collectAllDescendantReplyIds(child.id, queryRunner);
      allIds = allIds.concat(descendantIds);
    }

    return allIds;
  }


  async findReplyById(id: string) {
    const reply = await this.reviewReplyRepository.findOne({
      where: { id },
      relations: [
        'review',
        'episodeReview',
        'parentReply',
        'childReplies',
      ],
    });

    if (!reply) {
      throw new ReviewReplyNotFoundError();
    }

    const [enriched] = await this.enrichWithUserInfo([reply]);
    return enriched;
  }

  async findReplies(
    query: PaginationQueryDto & {
      reviewId?: string;
      episodeReviewId?: string;
      userId?: string;
      parentReplyId?: string;
      status?: REVIEW_STATUS;
    },
  ) {
    const {
      page = 1,
      limit = 10,
      sort,
      search,
      reviewId,
      episodeReviewId,
      userId,
      status,
      parentReplyId,
    } = query || {};

    const queryBuilder = this.reviewReplyRepository
      .createQueryBuilder('reply')
      .leftJoinAndSelect('reply.review', 'review')
      .leftJoinAndSelect('reply.episodeReview', 'episodeReview')
      .leftJoinAndSelect('reply.parentReply', 'parentReply');
    // Filter by status - default to ACTIVE if not specified
    const statusFilter = status || REVIEW_STATUS.ACTIVE;
    queryBuilder.andWhere('reply.status = :status', { status: statusFilter });

    if (reviewId){
      // find review id exist
      const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
      if (!review) {
        throw new ReviewNotFoundError();
      }
      queryBuilder.andWhere('review.id = :reviewId', { reviewId });
    } 
    if (episodeReviewId){
      // find episode review id exist
      const episodeReview = await this.reviewEpisodeRepository.findOne({ where: { id: episodeReviewId } });
      if (!episodeReview) {
        throw new ReviewNotFoundError();
      }
      queryBuilder.andWhere('episodeReview.id = :episodeReviewId', { episodeReviewId });
    }
    if (userId) queryBuilder.andWhere('reply.userId = :userId', { userId });

    // Filter by parentReplyId - if null, get top-level replies only
    if (parentReplyId === null || parentReplyId === 'null') {
      queryBuilder.andWhere('reply.parent_reply_id IS NULL');
    } else if (parentReplyId) {
      queryBuilder.andWhere('parentReply.id = :parentReplyId', { parentReplyId });
    }

    if (search) queryBuilder.andWhere('reply.content ILIKE :search', { search: `%${search}%` });

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.entries(sortObj).forEach(([key, order]) => {
        queryBuilder.addOrderBy(`reply.${key}`, order as 'ASC' | 'DESC');
      });
    } else {
      queryBuilder.orderBy('reply.createdAt', 'ASC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Attach reply counts
    if (data.length > 0) {
      const replyIds = data.map(reply => reply.id);
      const replyCounts = await this.getReplyCountsForReplies(replyIds);
      data.forEach(reply => {
        (reply as any).replyCount = replyCounts[reply.id] || 0;
      });
    }

    const enriched = await this.enrichWithUserInfo(data);
    return { data: enriched, total };
  }

  async isReplyOwner(replyId: string, userId: string): Promise<boolean> {
    const reply = await this.reviewReplyRepository.findOne({
      where: { id: replyId },
    });

    if (!reply) {
      throw new NotFoundException({
        message: `Reply not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    return reply.userId === userId;
  }

  async countRepliesForReview(reviewId: string): Promise<number> {
    return await this.reviewReplyRepository.count({
      where: {
        review: { id: reviewId },
        status: REVIEW_STATUS.ACTIVE,
      },
    });
  }

  async countRepliesForEpisodeReview(episodeReviewId: string): Promise<number> {
    return await this.reviewReplyRepository.count({
      where: {
        episodeReview: { id: episodeReviewId },
        status: REVIEW_STATUS.ACTIVE,
      },
    });
  }

  async countRepliesForReply(replyId: string): Promise<number> {
    return await this.reviewReplyRepository.count({
      where: {
        parentReply: { id: replyId },
        status: REVIEW_STATUS.ACTIVE,
      },
    });
  }

  async getReplyCountsForReviews(reviewIds: string[]): Promise<Record<string, number>> {
    if (!reviewIds.length) return {};
    const counts = await this.reviewReplyRepository
      .createQueryBuilder('reply')
      .select('reply.review_id', 'reviewId')
      .addSelect('COUNT(reply.id)', 'count')
      .where('reply.review_id IN (:...reviewIds)', { reviewIds })
      .andWhere('reply.status = :status', { status: REVIEW_STATUS.ACTIVE })
      .groupBy('reply.review_id')
      .getRawMany();

    const countMap: Record<string, number> = {};
    counts.forEach(item => {
      countMap[item.reviewId] = parseInt(item.count, 10);
    });

    reviewIds.forEach(id => {
      if (!(id in countMap)) countMap[id] = 0;
    });

    return countMap;
  }

  async getReplyCountsForEpisodeReviews(
    episodeReviewIds: string[],
  ): Promise<Record<string, number>> {
    if (!episodeReviewIds.length) return {};
    const counts = await this.reviewReplyRepository
      .createQueryBuilder('reply')
      .select('reply.episode_review_id', 'episodeReviewId')
      .addSelect('COUNT(reply.id)', 'count')
      .where('reply.episode_review_id IN (:...episodeReviewIds)', { episodeReviewIds })
      .andWhere('reply.status = :status', { status: REVIEW_STATUS.ACTIVE })
      .groupBy('reply.episode_review_id')
      .getRawMany();

    const countMap: Record<string, number> = {};
    counts.forEach(item => {
      countMap[item.episodeReviewId] = parseInt(item.count, 10);
    });

    episodeReviewIds.forEach(id => {
      if (!(id in countMap)) countMap[id] = 0;
    });

    return countMap;
  }

  async getReplyCountsForReplies(replyIds: string[]): Promise<Record<string, number>> {
    if (!replyIds.length) return {};
    const counts = await this.reviewReplyRepository
      .createQueryBuilder('reply')
      .select('reply.parent_reply_id', 'parentReplyId')
      .addSelect('COUNT(reply.id)', 'count')
      .where('reply.parent_reply_id IN (:...replyIds)', { replyIds })
      .andWhere('reply.status = :status', { status: REVIEW_STATUS.ACTIVE })
      .groupBy('reply.parent_reply_id')
      .getRawMany();

    const countMap: Record<string, number> = {};
    counts.forEach(item => {
      countMap[item.parentReplyId] = parseInt(item.count, 10);
    });

    replyIds.forEach(id => {
      if (!(id in countMap)) countMap[id] = 0;
    });

    return countMap;
  }
}
