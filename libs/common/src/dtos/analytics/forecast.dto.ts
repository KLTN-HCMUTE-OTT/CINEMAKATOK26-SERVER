import { ApiProperty } from '@nestjs/swagger';

export class ViewForecastDayDto {
  @ApiProperty()
  day: string;

  @ApiProperty()
  views: number;
}

export class ViewForecastItemDto {
  @ApiProperty()
  contentId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  contentType: string;

  @ApiProperty({ type: [ViewForecastDayDto] })
  historyViews: ViewForecastDayDto[];

  @ApiProperty()
  last7Avg: number;

  @ApiProperty({ type: [Number] })
  next7DaysViews: number[];

  @ApiProperty()
  totalForecast7d: number;

  @ApiProperty({ enum: ['up', 'down'] })
  predictedTrend: 'up' | 'down';
}

export class ChurnFeatureDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  accountAgeDays: number;

  @ApiProperty()
  daysSinceLastActivity: number;

  @ApiProperty()
  watchProgressCount30d: number;

  @ApiProperty()
  watchedDuration30d: number;

  @ApiProperty()
  completedVideos30d: number;

  @ApiProperty()
  watchlistAdds30d: number;

  @ApiProperty()
  favoriteAdds30d: number;

  @ApiProperty()
  reviews30d: number;

  @ApiProperty()
  auditEvents30d: number;
}

export class ChurnPredictionItemDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty()
  churnProbability: number;

  @ApiProperty()
  returnProbability: number;

  @ApiProperty({ enum: ['high', 'medium', 'low'] })
  riskLevel: 'high' | 'medium' | 'low';

  @ApiProperty({ type: ChurnFeatureDto })
  features: ChurnFeatureDto;
}
