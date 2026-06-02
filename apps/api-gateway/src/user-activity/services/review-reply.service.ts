import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

import { catchRpcError } from '@app/common/exceptions';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';
import { CreateReviewReplyDto, ReviewReplyDto, UpdateReviewReplyDto } from "@app/common/dtos/user-activity/review-reply.dto";

@Injectable()
export class ReviewReplyService {
  constructor(
    @Inject('USER_ACTIVITY_SERVICE')
    private readonly userActivityClient: ClientProxy,
  ) {}

  findReplies(query: PaginationQueryDto & { 
    reviewId?: string; 
    episodeReviewId?: string; 
    userId?: string; 
    parentReplyId?: string; 
    status?: REVIEW_STATUS 
  }): Observable<any> {
    return  this.userActivityClient
        .send({ cmd: 'activity.review-reply.list' }, query)
        .pipe(catchRpcError());
  }

  findRepliesForReview(reviewId: string, query: PaginationQueryDto & { parentReplyId?: string }): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.review-reply.list-for-review' }, { ...query, reviewId })
      .pipe(catchRpcError());
  }

  findRepliesForEpisodeReview(episodeReviewId: string, query: PaginationQueryDto & { parentReplyId?: string }): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.review-reply.list-for-episode-review' }, { ...query, episodeReviewId })
      .pipe(catchRpcError());
  }

  findRepliesByUserId(userId: string, query: PaginationQueryDto & { parentReplyId?: string }): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.review-reply.list-by-user' }, { ...query, userId })
      .pipe(catchRpcError());
  }

  findReplyById(id: string): Observable<any> {
    return  this.userActivityClient
        .send({ cmd: 'activity.review-reply.get' }, { id })
        .pipe(catchRpcError());
    
  }

  createReply(userId: string, createReplyDto: CreateReviewReplyDto): Observable<any> {
    return this.userActivityClient
        .send({ cmd: 'activity.review-reply.create' }, { ...createReplyDto, userId })
        .pipe(catchRpcError())
  }

  updateReply(id: string, updateReplyDto: UpdateReviewReplyDto, userId: string): Observable<any> {
    return this.userActivityClient
        .send({ cmd: 'activity.review-reply.update' }, { id, ...updateReplyDto, userId })
        .pipe(catchRpcError())
  }

  deleteReply(id: string, userId?: string): Observable<any> {
    return this.userActivityClient
        .send({ cmd: 'activity.review-reply.delete' }, { id, userId })
        .pipe(catchRpcError())
  }

  isReplyOwner(id: string, userId: string): Observable<any> {
    return this.userActivityClient
        .send({ cmd: 'activity.review-reply.check-owner' }, { id, userId })
        .pipe(catchRpcError());
  }

  countRepliesForReview(reviewId: string): Observable<any> {
    return this.userActivityClient
        .send({ cmd: 'activity.review-reply.count-by-review' }, { reviewId })
        .pipe(catchRpcError());
  }

  countRepliesForEpisodeReview(episodeReviewId: string): Observable<any> {
    return this.userActivityClient
        .send({ cmd: 'activity.review-reply.count-by-episode-review' }, { episodeReviewId })
        .pipe(catchRpcError());
  }

  countRepliesForReply(replyId: string): Observable<any> {
    return this.userActivityClient
        .send({ cmd: 'activity.review-reply.count-by-reply' }, { replyId })
        .pipe(catchRpcError());
  }
}
