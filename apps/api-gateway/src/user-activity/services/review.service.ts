import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { catchRpcError } from "@app/common/exceptions";
import { PaginationQueryDto } from "@app/common/utils/dto/pagination-query.dto";
import { CreateReviewDto, UpdateReviewDto } from "@app/common/dtos/user-activity/review.dto";
import { Observable } from "rxjs";
@Injectable()
export class ReviewService {
    constructor(
        @Inject('USER_ACTIVITY_SERVICE')
        private readonly reviewClient: ClientProxy,
    ) {}

    findReviews(query: PaginationQueryDto): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.list' }, query).pipe(catchRpcError());
    }
    findReviewsByUserId(query: PaginationQueryDto, userId: string): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.list-by-user' }, { ...query, userId }).pipe(catchRpcError());
    }
    findReviewsByContentId(query: PaginationQueryDto, contentId: string): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.list-by-content' }, { ...query, contentId }).pipe(catchRpcError());
    }

    findReviewById(id: string): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.get' }, { id }).pipe(catchRpcError());
    }

    createReview(userId: string, createReviewDto: CreateReviewDto): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.create' }, { ...createReviewDto, userId }).pipe(catchRpcError());
    }

    updateReview(id: string, updateReviewDto: UpdateReviewDto, userId: string): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.update' }, { ...updateReviewDto, id, userId }).pipe(catchRpcError());
    }

    deleteReview(id: string, userId?: string): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.delete' }, { id, userId }).pipe(catchRpcError());
    }

    isReviewOwner(id: string, userId: string): Observable<any> {
        return this.reviewClient.send({ cmd: 'activity.review.check-owner' }, { id, userId }).pipe(catchRpcError());
    }
}