import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty } from '@nestjs/swagger';

export class WatchProgressDto extends BaseEntityDto {
  @ApiProperty({
    description: 'ID of the video being watched',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  @Transform(({ obj }) => obj.video?.id || obj.videoId)
  videoId: string;

  @ApiProperty({
    description: 'Title of the content being watched',
    example: 'The Shawshank Redemption',
    nullable: true,
  })
  @Expose()
  @IsString()
  @Transform(({ obj }) => obj.video?.videoUrl || obj.contentTitle)
  contentTitle: string | null;

  @ApiProperty({
    description: 'Thumbnail of the video',
    example: 'https://example.com/thumbnail.jpg',
    nullable: true,
  })
  @Expose()
  @IsString()
  @Transform(({ obj }) => obj.video?.thumbnailUrl || obj.contentThumbnail)
  contentThumbnail: string | null;

  @ApiProperty({
    description: 'Last time the content was watched',
    example: '2025-11-17T10:30:00Z',
    nullable: true,
  })
  @Expose()
  lastWatched: Date | null;

  @ApiProperty({
    description: 'Duration watched in seconds',
    example: 3600,
  })
  @Expose()
  @IsNumber()
  watchedDuration: number;

  @ApiProperty({
    description: 'Whether the content has been completed',
    example: false,
  })
  @Expose()
  @IsBoolean()
  isCompleted: boolean;

  @ApiProperty({
    description: 'Movie ID (if the video belongs to a movie)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsUUID()
  movieId: string | null;

  @ApiProperty({
    description: 'Episode ID (if the video belongs to an episode)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsUUID()
  episodeId: string | null;

  @ApiProperty({
    description: 'TV Series ID (if the video belongs to an episode)',
    example: '550e8400-e29b-41d4-a716-446655440003',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsUUID()
  tvSeriesId: string | null;

  @ApiProperty({
    description: 'Episode number (if the video belongs to an episode)',
    example: 5,
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  episodeNumber: number | null;

  @ApiProperty({
    description: 'Season number (if the video belongs to an episode)',
    example: 2,
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  seasonNumber: number | null;

  @ApiProperty({
    description: 'Full content metadata including description, release date, rating, etc.',
    type: Object,
    nullable: true,
  })
  @Expose()
  @IsOptional()
  metadata: Record<string, any> | null;

  @ApiProperty({
    description: 'Duration of the content in seconds (for movies)',
    example: 7200,
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  duration: number | null;

  @ApiProperty({
    description: 'Video information',
    type: Object,
    nullable: true,
  })
  @Expose()
  @IsOptional()
  video: Record<string, any> | null;
}

export class CreateWatchProgressDto {
  @ApiProperty({
    description: 'ID of the video being watched',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  videoId: string;

  @ApiProperty({
    description: 'Duration watched in seconds',
    example: 1800,
  })
  @IsNumber()
  watchedDuration: number;
}

export class UpdateWatchProgressDto {
  @ApiProperty({
    description: 'Duration watched in seconds',
    example: 1800,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  watchedDuration?: number;

  @ApiProperty({
    description: 'Whether the content has been completed',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
