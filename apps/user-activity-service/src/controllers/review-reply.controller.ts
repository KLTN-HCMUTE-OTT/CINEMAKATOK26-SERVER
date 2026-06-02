import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ReviewReplyService } from "../services/review-reply.service";
import { PaginationQueryDto } from "@app/common/utils/dto/pagination-query.dto";
import { REVIEW_STATUS } from "@app/common/enums/global.enum";
import { CreateReviewReplyDto, UpdateReviewReplyDto } from "@app/common/dtos/user-activity/review-reply.dto";

@Controller('review-reply')
export class ReviewReplyController {
    constructor(
        private readonly reviewReplyService: ReviewReplyService,
    ) {}

    @MessagePattern({ cmd: 'activity.review-reply.list' })
    findReplies(@Payload() query: PaginationQueryDto & { 
        reviewId?: string; 
        episodeReviewId?: string; 
        userId?: string; 
        parentReplyId?: string; 
        status?: REVIEW_STATUS 
    }) {
        return this.reviewReplyService.findReplies(query);
    }

    @MessagePattern({ cmd: 'activity.review-reply.list-for-review' })
    findRepliesForReview(@Payload() payload: PaginationQueryDto & { reviewId: string, parentReplyId?: string } ) {
        const { reviewId, parentReplyId, ...query } = payload;
        return this.reviewReplyService.findReplies({ ...query, reviewId, parentReplyId });
    }

    @MessagePattern({ cmd: 'activity.review-reply.list-for-episode-review' })
    findRepliesForEpisodeReview(@Payload() payload: PaginationQueryDto & { episodeReviewId: string, parentReplyId?: string } ) {
        const { episodeReviewId, parentReplyId, ...query } = payload;
        return this.reviewReplyService.findReplies({ ...query, episodeReviewId, parentReplyId });
    }

    @MessagePattern({ cmd: 'activity.review-reply.list-by-user' })
    findRepliesByUserId(@Payload() payload: PaginationQueryDto & { userId: string, parentReplyId?: string } ) {
        const { userId, parentReplyId, ...query } = payload;
        return this.reviewReplyService.findReplies({ ...query, userId, parentReplyId });
    }

    @MessagePattern({ cmd: 'activity.review-reply.get' })
    findReplyById(@Payload() payload: { id: string }) {
        return this.reviewReplyService.findReplyById(payload.id);
    }

    @MessagePattern({ cmd: 'activity.review-reply.create' })
    createReply(@Payload() payload: CreateReviewReplyDto & { userId: string }) {
        const { userId, ...createDto } = payload;
        return this.reviewReplyService.createReply(userId, createDto as CreateReviewReplyDto);
    }

    @MessagePattern({ cmd: 'activity.review-reply.update' })
    updateReply(@Payload() payload: UpdateReviewReplyDto & { id: string, userId: string }) {
        const { id, userId, ...updateDto } = payload;
        return this.reviewReplyService.updateReply(id, updateDto as UpdateReviewReplyDto, userId);
    }

    @MessagePattern({ cmd: 'activity.review-reply.delete' })
    deleteReply(@Payload() payload: { id: string, userId: string }) {
        return this.reviewReplyService.deleteReply(payload.id, payload.userId);
    }

    @MessagePattern({ cmd: 'activity.review-reply.check-owner' })
    isReplyOwner(@Payload() payload: { id: string, userId: string }) {
        return this.reviewReplyService.isReplyOwner(payload.id, payload.userId);
    }

    @MessagePattern({ cmd: 'activity.review-reply.count-by-review' })
    getReplyCountForReview(@Payload() payload: { reviewId: string }) {
        return this.reviewReplyService.countRepliesForReview(payload.reviewId);
    }

    @MessagePattern({ cmd: 'activity.review-reply.count-by-episode-review' })
    getReplyCountForEpisodeReview(@Payload() payload: { episodeReviewId: string }) {
        return this.reviewReplyService.countRepliesForEpisodeReview(payload.episodeReviewId);
    }

    @MessagePattern({ cmd: 'activity.review-reply.count-by-reply' })
    getReplyCountForReply(@Payload() payload: { replyId: string }) {
        return this.reviewReplyService.countRepliesForReply(payload.replyId);
    }

    @MessagePattern({ cmd: 'activity.review-reply.counts-by-reviews' })
    getReplyCountsForReviews(@Payload() payload: { reviewIds: string[] }) {
        return this.reviewReplyService.getReplyCountsForReviews(payload.reviewIds);
    }

    @MessagePattern({ cmd: 'activity.review-reply.counts-by-episode-reviews' })
    getReplyCountsForEpisodeReviews(@Payload() payload: { episodeReviewIds: string[] }) {
        return this.reviewReplyService.getReplyCountsForEpisodeReviews(payload.episodeReviewIds);
    }

    @MessagePattern({ cmd: 'activity.review-reply.counts-by-replies' })
    getReplyCountsForReplies(@Payload() payload: { replyIds: string[] }) {
        return this.reviewReplyService.getReplyCountsForReplies(payload.replyIds);
    }
}
