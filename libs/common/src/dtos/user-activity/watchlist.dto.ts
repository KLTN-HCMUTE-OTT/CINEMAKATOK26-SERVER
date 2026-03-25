import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty } from '@nestjs/swagger';

export class WatchListContentDto {
  @ApiProperty({ description: 'Movie ID or TV series ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Content metadata ID' })
  @Expose()
  contentId: string;

  @ApiProperty({ description: 'Content type (MOVIE or TVSERIES)' })
  @Expose()
  type: string;

  @ApiProperty({ description: 'Content title' })
  @Expose()
  title: string;

  @ApiProperty({ description: 'Content description' })
  @Expose()
  description: string;

  @ApiProperty({ description: 'Thumbnail URL' })
  @Expose()
  thumbnail: string;

  @ApiProperty({ description: 'Release date' })
  @Expose()
  releaseDate: Date;

  @ApiProperty({ description: 'Trailer URL' })
  @Expose()
  trailer: string;

  @ApiProperty({ description: 'Maturity rating' })
  @Expose()
  maturityRating: string;

  @ApiProperty({ description: 'Category names', type: [String] })
  @Expose()
  categories: string[];

  @ApiProperty({ description: 'Duration in minutes (movie only)' })
  @Expose()
  duration: number;
}

export class WatchListDto extends BaseEntityDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  @Expose()
  userId: string;

  @ApiProperty({ description: 'Content info', type: WatchListContentDto })
  @ValidateNested()
  @Type(() => WatchListContentDto)
  @Expose()
  content: WatchListContentDto;
}

export class CreateWatchListDto {
  @ApiProperty({
    description: 'Content ID to add to watchlist',
    example: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  contentId: string;
}
