import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject('ANALYTICS_SERVICE') private readonly analyticsClient: ClientProxy,
  ) {}

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
    this.emit('analytics.stream.started', { userId, contentId, ts: Date.now() });
  }
}
