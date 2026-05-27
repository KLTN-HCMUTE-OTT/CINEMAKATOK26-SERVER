import { Expose, Transform } from 'class-transformer';
import { IsArray, IsUUID } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class FavoriteStatusDto {
  @ApiProperty({
    description: 'Total number of favorites for the content',
    example: 100,
  })
  @Expose()
  totalFavorites: number;

  @ApiProperty({
    description: 'Indicates if the content is favorited by the user',
    example: true,
  })
  @Expose()
  isFavorited: boolean;
}

export class FavoriteItemDto {
  @ApiProperty({ description: 'Content metadata ID', example: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Movie ID if content is a movie',
    nullable: true,
    example: 'uuid',
  })
  @Expose()
  movieId: string | null;

  @ApiProperty({
    description: 'TV series ID if content is a TV series',
    nullable: true,
    example: 'uuid',
  })
  @Expose()
  tvSeriesId: string | null;

  @ApiProperty({ description: 'Content title' })
  @Expose()
  title: string;

  @ApiProperty({ description: 'Content type (MOVIE or TVSERIES)' })
  @Expose()
  type: string;

  @ApiProperty({ description: 'Release date' })
  @Transform(({ value }) => {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      return value.split('T')[0];
    }
    return value;
  })
  @Expose()
  releaseDate: string;

  @ApiProperty({ description: 'Thumbnail URL' })
  @Expose()
  thumbnail: string;

  @ApiProperty({ description: 'Banner URL', nullable: true })
  @Expose()
  banner: string | null;

  @ApiProperty({ description: 'Trailer URL' })
  @Expose()
  trailer: string;

  @ApiProperty({
    description: 'Duration in minutes (movie only)',
    nullable: true,
  })
  @Expose()
  duration: number | null;
}

export class CreateFavoriteDto {
  @ApiProperty({ description: 'Content ID to be favorited', example: 'uuid' })
  @IsUUID()
  @Expose()
  contentId: string;
}

export class DeleteFavoriteDto {
  @ApiProperty({
    description: 'List of content IDs to remove from favorites',
    example: ['uuid1', 'uuid2'],
  })
  @Expose()
  @IsArray()
  contentIds: string[];
}
