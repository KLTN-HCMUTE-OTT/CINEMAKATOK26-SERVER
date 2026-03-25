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
    findReplies(@Payload() query: PaginationQueryDto & { status?: REVIEW_STATUS }) {
        return this.reviewReplyService.findReplies(query);
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
}
