import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';

import { AnalyticsService } from '../service/analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @MessagePattern({ cmd: 'analytics.getMoviesStats' })
  getMoviesStats(@Payload() query: PaginationQueryDto) {
    return this.analyticsService.getMoviesStats(query || {});
  }

  @MessagePattern({ cmd: 'analytics.getTVSeriesStats' })
  getTVSeriesStats(@Payload() query: PaginationQueryDto) {
    return this.analyticsService.getTVSeriesStats(query || {});
  }

  @MessagePattern({ cmd: 'analytics.getCategoriesStats' })
  getCategoriesStats(@Payload() query: PaginationQueryDto) {
    return this.analyticsService.getCategoriesStats(query || {});
  }

  @MessagePattern({ cmd: 'analytics.getUserStats' })
  getUserStats() {
    return this.analyticsService.getUserStats();
  }

  @MessagePattern({ cmd: 'analytics.getTrendingMovies' })
  getTrendingMovies(@Payload() query: PaginationQueryDto) {
    return this.analyticsService.getTrendingMovies(query || {});
  }

  @MessagePattern({ cmd: 'analytics.getTrendingTVSeries' })
  getTrendingTVSeries(@Payload() query: PaginationQueryDto) {
    return this.analyticsService.getTrendingTVSeries(query || {});
  }
}
