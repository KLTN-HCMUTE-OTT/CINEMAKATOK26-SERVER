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
