import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ReviewService } from "../services/review.service";
import { PaginationQueryDto } from "@app/common/utils/dto/pagination-query.dto";
import { CreateReviewDto, UpdateReviewDto } from "@app/common/dtos/user-activity/review.dto";

@Controller('review')
export class ReviewController {
    constructor(
        private readonly reviewService: ReviewService,
    ) {}

    @MessagePattern({ cmd: 'activity.review.list' })
    findReviews(@Payload() query: PaginationQueryDto) {
        return this.reviewService.findReviews(query);
    }

    @MessagePattern({ cmd: 'activity.review.list-by-user' })
    findReviewsByUserId(@Payload() payload: PaginationQueryDto & { userId: string }) {
        return this.reviewService.findReviews(payload);
    }

    @MessagePattern({ cmd: 'activity.review.list-by-content' })
    findReviewsByContentId(@Payload() payload: PaginationQueryDto & { contentId: string }) {
        return this.reviewService.findReviews(payload);
    }

    @MessagePattern({ cmd: 'activity.review.get' })
    findReviewById(@Payload() payload: { id: string }) {
        return this.reviewService.findReviewById(payload.id);
    }

    @MessagePattern({ cmd: 'activity.review.create' })
    createReview(@Payload() payload: CreateReviewDto & { userId: string }) {
        const { userId, ...createReviewDto } = payload;
        return this.reviewService.createReview(userId, createReviewDto as CreateReviewDto);
    }

    @MessagePattern({ cmd: 'activity.review.update' })
    updateReview(@Payload() payload: UpdateReviewDto & { id: string, userId: string }) {
        const { id, userId, ...updateReviewDto } = payload;
        return this.reviewService.updateReview(id, updateReviewDto as UpdateReviewDto, userId);
    }

    @MessagePattern({ cmd: 'activity.review.delete' })
    deleteReview(@Payload() payload: { id: string, userId: string }) {
        return this.reviewService.deleteReview(payload.id, payload.userId);
    }

    @MessagePattern({ cmd: 'activity.review.check-owner' })
    isReviewOwner(@Payload() payload: { id: string, userId: string }) {
        return this.reviewService.isReviewOwner(payload.id, payload.userId);
    }
}