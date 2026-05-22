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
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { CreateEpisodeReviewDto, UpdateEpisodeReviewDto } from '@app/common/dtos/user-activity/episode-review.dto';
import { EntityReport } from '../entities/report.entity';
import { EntityReviewEpisode } from '../entities/review-episode.entity';
import { EntityReviewReply } from '../entities/review-reply.entity';
import { CreateReviewFailedError, DomainError, ReviewNotFoundError, UpdateReviewFailedError, DeleteReviewFailedError, GetReviewsFailedError, ContentNotFoundError } from '@app/common/exceptions/domain.error';
import { catchRpcError } from '@app/common/exceptions';
import { AuditLogEmitterService } from './audit-log-emitter.service';
import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';

@Injectable()
export class EpisodeReviewService {
  constructor(
    @InjectRepository(EntityReviewEpisode, 'activity')
    private readonly reviewEpisodeRepository: Repository<EntityReviewEpisode>,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    private readonly auditLogEmitter: AuditLogEmitterService,
  ) {}

  async createReview(userId: string, createEpisodeReviewDto: CreateEpisodeReviewDto) {
    try{
      const content = await firstValueFrom(
      this.contentClient.send({ cmd: 'content.getEpisodeById' }, { id: createEpisodeReviewDto.episodeId }),
    );

    if (!content) {
      throw new NotFoundException({ message: `Content not found`, code: ERROR_CODE.ENTITY_NOT_FOUND });
    }

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

    // Emit audit log after successful save
    this.auditLogEmitter.emitLog({
      userId,
      action: LOG_ACTION.CREATE_REVIEW,
      resourceType: RESOURCE_TYPE.SERIES,
      resourceId: content?.season?.tvseries?.id || undefined,
      metadata: { episodeId: createEpisodeReviewDto.episodeId, reviewId: savedReview.id },
    });

    return savedReview;
    }
    catch(error){
      if(error instanceof DomainError || error instanceof HttpException || (error as any).code){
        throw error;
      }
      throw new CreateReviewFailedError();
    }
  }

  async updateReview(id: string, updateReviewDto: UpdateEpisodeReviewDto, userId?: string) {
    try{
      const review = await this.findReviewById(id);

    if (userId && review.userId !== userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to update this review',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    Object.assign(review, updateReviewDto);
    const updatedReview = await this.reviewEpisodeRepository.save(review);

    // Emit audit log after successful save
    try {
      const episodeData = await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getEpisodeById' },
          { id: review.episodeId },
        ),
      ).catch(() => null);
      const seriesId = episodeData?.season?.tvseries?.id;

      this.auditLogEmitter.emitLog({
        userId: userId ?? review.userId,
        action: LOG_ACTION.UPDATE_REVIEW,
        resourceType: RESOURCE_TYPE.SERIES,
        resourceId: seriesId || undefined,
        metadata: { episodeId: review.episodeId, reviewId: id },
      });
    } catch {
      // ignore
    }
    
    return updatedReview;
    }
    catch(error){
      if(error instanceof DomainError || error instanceof HttpException || (error as any).code){
        throw error;
      }
      throw new UpdateReviewFailedError();
    }
  }

  async deleteReview(id: string, userId?: string) {
    try{
      const review = await this.findReviewById(id);

    if (userId && review.userId !== userId) {
      throw new ForbiddenException({
        message: 'You are not authorized to delete this review',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }

    await this.reviewEpisodeRepository.manager.transaction(async (manager) => {
        await manager.delete(EntityReviewReply, { episodeReview: { id } });

        await manager.delete(EntityReport, {
            targetId: id,
            type: REPORT_TYPE.EPISODE_REVIEW,
        });

        await manager.delete(EntityReviewEpisode, id);
    });

    // Emit audit log after successful delete
    try {
      const episodeData = await firstValueFrom(
        this.contentClient.send(
          { cmd: 'content.getEpisodeById' },
          { id: review.episodeId },
        ),
      ).catch(() => null);
      const seriesId = episodeData?.season?.tvseries?.id;

      this.auditLogEmitter.emitLog({
        userId: userId ?? review.userId,
        action: LOG_ACTION.DELETE_REVIEW,
        resourceType: RESOURCE_TYPE.SERIES,
        resourceId: seriesId || undefined,
        metadata: { episodeId: review.episodeId, reviewId: id },
      });
    } catch {
      // ignore
    }

    return true;
    }
    catch(error){
      if(error instanceof DomainError || error instanceof HttpException || (error as any).code){
        throw error;
      }
      throw new DeleteReviewFailedError();
    }
  }

  async findReviewById(id: string) {
    const review = await this.reviewEpisodeRepository.findOne({
      where: { id },
    });
    
    if (!review) {
      throw new ReviewNotFoundError();
    }
    return review;
  }

  async findReviews(query: PaginationQueryDto & { episodeId?: string; userId?: string; status?: REVIEW_STATUS }) {
    try{
    const { page = 1, limit = 10, sort, search, episodeId, userId, status } = query || {};

    const queryBuilder = this.reviewEpisodeRepository.createQueryBuilder('review');

    // Filter by status - default to ACTIVE if not specified
    const statusFilter = status || REVIEW_STATUS.ACTIVE;
    queryBuilder.andWhere('review.status = :status', { status: statusFilter });

    if (episodeId) {
      await firstValueFrom(
        this.contentClient.send({ cmd: 'content.getEpisodeById' }, { id: episodeId })
        .pipe(catchRpcError()),
      );

      queryBuilder.andWhere('review.episodeId = :episodeId', { episodeId });
    }
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
    catch(error){
       if (error instanceof RpcException) {
        throw error;
      }
      throw new GetReviewsFailedError();
    }
  }

  async isReviewOwner(reviewId: string, userId: string): Promise<boolean> {
    const review = await this.findReviewById(reviewId);
    return review.userId === userId;
  }
}
