import { Repository, In } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { REPORT_TYPE, REVIEW_STATUS } from '@app/common/enums/global.enum';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateReviewReplyDto, UpdateReviewReplyDto } from '@app/common/dtos/user-activity/review-reply.dto';
import { EntityReport } from '../entities/report.entity';
import { EntityReviewEpisode } from '../entities/review-episode.entity';
import { EntityReviewReply } from '../entities/review-reply.entity';
import { EntityReview } from '../entities/review.entity';

@Injectable()
export class ReviewReplyService {
  constructor(
    @InjectRepository(EntityReviewReply, 'activity')
    private readonly reviewReplyRepository: Repository<EntityReviewReply>,
    @InjectRepository(EntityReview, 'activity')
    private readonly reviewRepository: Repository<EntityReview>,
    @InjectRepository(EntityReviewEpisode, 'activity')
    private readonly reviewEpisodeRepository: Repository<EntityReviewEpisode>,
  ) {}

  async createReply(userId: string, createReplyDto: CreateReviewReplyDto) {
    const { reviewId, episodeReviewId, parentReplyId, content } = createReplyDto;

    if (!reviewId && !episodeReviewId) {
      throw new ForbiddenException({
        message: 'Either reviewId or episodeReviewId must be provided',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    if (reviewId && episodeReviewId) {
      throw new ForbiddenException({
        message: 'Cannot provide both reviewId and episodeReviewId',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    // Check target existence
    if (reviewId) {
      const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
      if (!review) throw new NotFoundException('Review not found');
    } else {
      const episodeReview = await this.reviewEpisodeRepository.findOne({ where: { id: episodeReviewId } });
      if (!episodeReview) throw new NotFoundException('Episode review not found');
    }

    if (parentReplyId) {
      const parentReply = await this.reviewReplyRepository.findOne({
        where: { id: parentReplyId },
        relations: ['review', 'episodeReview']
      });

      if (!parentReply) throw new NotFoundException('Parent reply not found');

      if (reviewId && parentReply.review?.id !== reviewId) {
        throw new ForbiddenException('Parent reply does not belong to the specified review');
      }

      if (episodeReviewId && parentReply.episodeReview?.id !== episodeReviewId) {
        throw new ForbiddenException('Parent reply does not belong to the specified episode review');
      }
    }

    const reply = this.reviewReplyRepository.create({
      content,
      userId,
      review: reviewId ? { id: reviewId } : null,
      episodeReview: episodeReviewId ? { id: episodeReviewId } : null,
      parentReply: parentReplyId ? { id: parentReplyId } : null,
    });

    const savedReply = await this.reviewReplyRepository.save(reply);
    return savedReply;
  }

  async updateReply(id: string, updateReplyDto: UpdateReviewReplyDto, userId?: string) {
    const reply = await this.findReplyById(id);

    if (userId && reply.userId !== userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to update this reply',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    Object.assign(reply, updateReplyDto);
    return this.reviewReplyRepository.save(reply);
  }

  async deleteReply(id: string, userId?: string) {
    const reply = await this.findReplyById(id);

    if (userId && reply.userId !== userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to delete this reply',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    await this.reviewReplyRepository.manager.transaction(async (manager) => {
        // Find all child replies recursively might be slow, but for simplicity we'll delete the hierarchy
        // In a real scenario, we might use a closure table or MPTT
        
        // Delete reports for this reply and its children (simple for now)
        await manager.delete(EntityReport, {
            targetId: id,
            type: REPORT_TYPE.REVIEW_REPLY,
        });

        // Delete the reply itself - cascade deletes childReplies if configured in EntityReviewReply
        // EntityReviewReply has onDelete: 'CASCADE' for parentReply relation
        await manager.delete(EntityReviewReply, id);
    });
  }

  async findReplyById(id: string) {
    const reply = await this.reviewReplyRepository.findOne({
      where: { id },
    });

    if (!reply) {
      throw new NotFoundException({
        message: `Reply not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    return reply;
  }

  async findReplies(query: PaginationQueryDto & {
      reviewId?: string;
      episodeReviewId?: string;
      userId?: string;
      parentReplyId?: string;
      status?: REVIEW_STATUS;
  }) {
    const { page = 1, limit = 10, sort, search, reviewId, episodeReviewId, userId, status, parentReplyId } = query || {};

    const queryBuilder = this.reviewReplyRepository.createQueryBuilder('reply');

    const statusFilter = status || REVIEW_STATUS.ACTIVE;
    queryBuilder.andWhere('reply.status = :status', { status: statusFilter });

    if (reviewId) queryBuilder.andWhere('reply.reviewId = :reviewId', { reviewId });
    if (episodeReviewId) queryBuilder.andWhere('reply.episodeReviewId = :episodeReviewId', { episodeReviewId });
    if (userId) queryBuilder.andWhere('reply.userId = :userId', { userId });

    if (parentReplyId === null || parentReplyId === 'null') {
      queryBuilder.andWhere('reply.parent_reply_id IS NULL');
    } else if (parentReplyId) {
      queryBuilder.andWhere('reply.parent_reply_id = :parentReplyId', { parentReplyId });
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

    return { data, total };
  }

  async isReplyOwner(replyId: string, userId: string): Promise<boolean> {
    const reply = await this.findReplyById(replyId);
    return reply.userId === userId;
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
      counts.forEach(item => countMap[item.reviewId] = parseInt(item.count, 10));
      reviewIds.forEach(id => { if (!(id in countMap)) countMap[id] = 0; });
      return countMap;
  }

  async getReplyCountsForEpisodeReviews(episodeReviewIds: string[]): Promise<Record<string, number>> {
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
      counts.forEach(item => countMap[item.episodeReviewId] = parseInt(item.count, 10));
      episodeReviewIds.forEach(id => { if (!(id in countMap)) countMap[id] = 0; });
      return countMap;
  }
}
