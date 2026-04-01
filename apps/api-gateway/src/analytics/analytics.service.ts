import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

import { catchRpcError } from '@app/common/exceptions';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject('ANALYTICS_SERVICE') private readonly analyticsClient: ClientProxy,
  ) {}

  getMoviesStats(query: PaginationQueryDto): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getMoviesStats' }, query)
      .pipe(catchRpcError());
  }

  getTVSeriesStats(query: PaginationQueryDto): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getTVSeriesStats' }, query)
      .pipe(catchRpcError());
  }

  getCategoriesStats(query: PaginationQueryDto): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getCategoriesStats' }, query)
      .pipe(catchRpcError());
  }

  getUserStats(): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getUserStats' }, {})
      .pipe(catchRpcError());
  }

  getTrendingMovies(query: PaginationQueryDto): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getTrendingMovies' }, query)
      .pipe(catchRpcError());
  }

  getTrendingTVSeries(query: PaginationQueryDto): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getTrendingTVSeries' }, query)
      .pipe(catchRpcError());
  }

  getViewForecast(query: PaginationQueryDto): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getViewForecast' }, query)
      .pipe(catchRpcError());
  }

  getChurnPrediction(query: PaginationQueryDto): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.getChurnPrediction' }, query)
      .pipe(catchRpcError());
  }

  retrainForecast(): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.retrainForecast' }, {})
      .pipe(catchRpcError());
  }

  retrainChurnPrediction(): Observable<any> {
    return this.analyticsClient
      .send({ cmd: 'analytics.retrainChurnPrediction' }, {})
      .pipe(catchRpcError());
  }

  /**
   * Fire-and-forget: publish a tracking event to the analytics queue.
   */
  emit(event: string, payload: Record<string, any>): void {
    this.analyticsClient.emit(event, payload);
    this.logger.debug(`Emitted analytics event: ${event}`);
  }

  trackMovieView(userId: string, movieId: string): void {
    this.emit('analytics.movie.viewed', { userId, movieId, ts: Date.now() });
  }

  trackOrderCreated(userId: string, orderId: string): void {
    this.emit('analytics.order.created', { userId, orderId, ts: Date.now() });
  }

  trackStreamStarted(userId: string, contentId: string): void {
    this.emit('analytics.stream.started', {
      userId,
      contentId,
      ts: Date.now(),
    });
  }
}
