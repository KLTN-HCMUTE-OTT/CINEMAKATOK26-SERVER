import { ApiProperty } from '@nestjs/swagger';

export class ViewStatsItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title?: string;

  @ApiProperty()
  name?: string;

  @ApiProperty()
  views: number;

  @ApiProperty({ enum: ['up', 'down'] })
  trending: 'up' | 'down';

  @ApiProperty()
  change: string;

  @ApiProperty()
  percentage: number;
}

export class PaginatedViewStatsDto {
  @ApiProperty({ type: [ViewStatsItemDto] })
  data: ViewStatsItemDto[];

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  itemsPerPage: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  currentPage: number;
}

export class UserSummaryDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  activeUsers: number;

  @ApiProperty()
  newUsers: number;

  @ApiProperty()
  churnRate: number;
}

export class DAUMetricDto {
  @ApiProperty()
  day: string;

  @ApiProperty()
  users: number;

  @ApiProperty({ enum: ['up', 'down'] })
  trend: 'up' | 'down';
}

export class MAUMetricDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  users: number;

  @ApiProperty({ enum: ['up', 'down'] })
  trend: 'up' | 'down';

  @ApiProperty()
  change: string;
}

export class ChurnRateMetricDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  rate: number;

  @ApiProperty({ enum: ['up', 'down'] })
  trend: 'up' | 'down';
}

export class UserMetricsDto {
  @ApiProperty({ type: [DAUMetricDto] })
  dau: DAUMetricDto[];

  @ApiProperty({ type: [MAUMetricDto] })
  mau: MAUMetricDto[];

  @ApiProperty({ type: [ChurnRateMetricDto] })
  churnRate: ChurnRateMetricDto[];
}

export class UserStatsDto {
  @ApiProperty({ type: UserSummaryDto })
  summary: UserSummaryDto;

  @ApiProperty({ type: UserMetricsDto })
  userMetrics: UserMetricsDto;
}

export class TrendingItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  poster: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  views: number;

  @ApiProperty({ enum: ['up', 'down'] })
  trend: 'up' | 'down';

  @ApiProperty()
  change: string;

  @ApiProperty()
  engagement: number;
}

export class PaginatedTrendingDataDto {
  @ApiProperty({ type: [TrendingItemDto] })
  data: TrendingItemDto[];

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  itemsPerPage: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  currentPage: number;
}
