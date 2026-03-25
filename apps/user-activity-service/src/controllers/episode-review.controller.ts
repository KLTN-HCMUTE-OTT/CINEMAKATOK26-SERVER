import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { EpisodeReviewService } from "../services/episode-review.service";
import { PaginationQueryDto } from "@app/common/utils/dto/pagination-query.dto";
import { CreateEpisodeReviewDto, UpdateEpisodeReviewDto } from '@app/common/dtos/user-activity/episode.-review.dto';
import { REVIEW_STATUS } from "@app/common/enums/global.enum";

@Controller('episode-review')
export class EpisodeReviewController {
    constructor(
        private readonly episodeReviewService: EpisodeReviewService,
    ) {}

    @MessagePattern({ cmd: 'activity.episode-review.list' })
    findReviews(@Payload() query: PaginationQueryDto & { status?: REVIEW_STATUS }) {
        return this.episodeReviewService.findReviews(query);
    }

    @MessagePattern({ cmd: 'activity.episode-review.list-by-user' })
    findReviewsByUserId(@Payload() payload: PaginationQueryDto & { userId: string, status?: REVIEW_STATUS }) {
        return this.episodeReviewService.findReviews(payload);
    }

    @MessagePattern({ cmd: 'activity.episode-review.list-by-episode' })
    findReviewsByEpisodeId(@Payload() payload: PaginationQueryDto & { episodeId: string, status?: REVIEW_STATUS }) {
        return this.episodeReviewService.findReviews(payload);
    }

    @MessagePattern({ cmd: 'activity.episode-review.get' })
    findReviewById(@Payload() payload: { id: string }) {
        return this.episodeReviewService.findReviewById(payload.id);
    }

    @MessagePattern({ cmd: 'activity.episode-review.create' })
    createReview(@Payload() payload: CreateEpisodeReviewDto & { userId: string }) {
        const { userId, ...createDto } = payload;
        return this.episodeReviewService.createReview(userId, createDto as CreateEpisodeReviewDto);
    }

    @MessagePattern({ cmd: 'activity.episode-review.update' })
    updateReview(@Payload() payload: UpdateEpisodeReviewDto & { id: string, userId: string }) {
        const { id, userId, ...updateDto } = payload;
        return this.episodeReviewService.updateReview(id, updateDto as UpdateEpisodeReviewDto, userId);
    }

    @MessagePattern({ cmd: 'activity.episode-review.delete' })
    deleteReview(@Payload() payload: { id: string, userId: string }) {
        return this.episodeReviewService.deleteReview(payload.id, payload.userId);
    }

    @MessagePattern({ cmd: 'activity.episode-review.check-owner' })
    isReviewOwner(@Payload() payload: { id: string, userId: string }) {
        return this.episodeReviewService.isReviewOwner(payload.id, payload.userId);
    }
}
