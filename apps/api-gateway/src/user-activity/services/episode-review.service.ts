import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { catchRpcError } from "@app/common/exceptions";
import { PaginationQueryDto } from "@app/common/utils/dto";
import { REVIEW_STATUS } from "@app/common/enums/global.enum";
import { Observable } from "rxjs";
import { CreateEpisodeReviewDto, UpdateEpisodeReviewDto } from "@app/common/dtos/user-activity/episode-review.dto";

@Injectable()
export class EpisodeReviewService {
    constructor(
        @Inject('USER_ACTIVITY_SERVICE')
        private readonly userActivityClient: ClientProxy,
    ) {}

    createEpisodeReview(userId: string, createEpisodeReviewDto: CreateEpisodeReviewDto): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.create' }, { ...createEpisodeReviewDto, userId })
            .pipe(catchRpcError());
    }

    getEpisodeReviews(query: PaginationQueryDto & { episodeId?: string; userId?: string; status?: REVIEW_STATUS }): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.list' }, { query })
            .pipe(catchRpcError());
    }

    getEpisodeReviewsByUserId(query: PaginationQueryDto & { episodeId?: string; userId?: string; status?: REVIEW_STATUS }): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.list-by-user' }, { query, userId: query.userId, status: query.status })
            .pipe(catchRpcError());
    }

    getEpisodeReviewsByEpisodeId(query: PaginationQueryDto & { episodeId?: string; userId?: string; status?: REVIEW_STATUS }): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.list-by-episode' }, { ...query })
            .pipe(catchRpcError());
    }

    getEpisodeReviewById(episodeReviewId: string): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.get' }, { episodeReviewId })
            .pipe(catchRpcError());
    }

    updateEpisodeReview(updateEpisodeReviewDto: UpdateEpisodeReviewDto, episodeReviewId: string, userId: string): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.update' }, { ...updateEpisodeReviewDto, episodeReviewId, userId })
            .pipe(catchRpcError());
    }

    checkReviewOwner(episodeReviewId: string, userId: string): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.check-owner' }, { episodeReviewId, userId })
            .pipe(catchRpcError());
    }

    deleteEpisodeReview(episodeReviewId: string, userId?: string): Observable<any> {
        return this.userActivityClient
            .send({ cmd: 'activity.episode-review.delete' }, { episodeReviewId, userId })
            .pipe(catchRpcError());
    }
}