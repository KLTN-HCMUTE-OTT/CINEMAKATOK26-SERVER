import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsNotEmpty, IsObject, ValidateNested } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { ContentType } from 'apps/content-service/src/entities/content.entity';
import { MovieDto } from './movies.dto';
import { TVSeriesSummaryDto } from './tvseries.dto';

export enum RecommendationSource {
  AI_RECOMMENDATION = 'ai_recommendation',
  FALLBACK_TRENDING = 'fallback_trending',
}

export class RecommendationItemDto {
  @ApiProperty({
    description: 'Rank of the recommendation',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Expose()
  rank: number;

  @ApiProperty({
    description: 'Score from recommendation algorithm',
    example: 0.95,
  })
  @IsNumber()
  @IsNotEmpty()
  @Expose()
  lgbScore: number;

  @ApiProperty({
    description: 'Type of the content (MOVIE or TVSERIES)',
    enum: ContentType,
    example: ContentType.MOVIE,
  })
  @IsEnum(ContentType)
  @IsNotEmpty()
  @Expose()
  type: ContentType;

  @ApiProperty({
    description: 'Content object (MovieDto or TVSeriesSummaryDto)',
    type: Object,
  })
  @IsObject()
  @IsNotEmpty()
  @Expose()
  item: MovieDto | TVSeriesSummaryDto;
}

export class RecommendationResponseDataDto {
  @ApiProperty({
    description: 'List of recommended items',
    type: [RecommendationItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationItemDto)
  @Expose()
  recommendations: RecommendationItemDto[];

  @ApiProperty({
    description: 'Total number of items',
    example: 10,
  })
  @IsNumber()
  @IsNotEmpty()
  @Expose()
  total: number;

  @ApiProperty({
    description: 'Source of recommendation data',
    enum: RecommendationSource,
    example: RecommendationSource.AI_RECOMMENDATION,
  })
  @IsEnum(RecommendationSource)
  @IsNotEmpty()
  @Expose()
  source: RecommendationSource;
}
