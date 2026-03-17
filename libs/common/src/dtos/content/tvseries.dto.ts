import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty, OmitType } from '@nestjs/swagger';

import { ContentDto, CreateContentDto, UpdateContentDto } from './content.dto';
import { CreateEpisodeDto, EpisodeDto, UpdateEpisodeDto } from './episode.dto';

export class SeasonDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Season number',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Expose()
  seasonNumber: number;

  @ApiProperty({
    description: 'Total number of episodes in the season',
    example: 10,
  })
  @IsNotEmpty()
  @IsNumber()
  @Expose()
  totalEpisodes: number;

  @ApiProperty({
    description: 'List of episode information',
    type: [EpisodeDto],
  })
  @Type(() => EpisodeDto)
  @ValidateNested({ each: true })
  @Expose()
  episodes: EpisodeDto[];
}
export class CreateSeasonDto extends OmitType(SeasonDto, [
  'id',
  'createdAt',
  'updatedAt',
  'totalEpisodes',
  'episodes',
]) {
  @ApiProperty({
    description: 'List of episode information',
    type: [CreateEpisodeDto],
  })
  @Type(() => CreateEpisodeDto)
  @ValidateNested({ each: true })
  @Expose()
  episodes: CreateEpisodeDto[];
}
export class UpdateSeasonDto extends OmitType(SeasonDto, [
  'totalEpisodes',
  'createdAt',
  'updatedAt',
  'episodes',
]) {
  @ApiProperty({
    description: 'List of episode information',
    type: [UpdateEpisodeDto],
  })
  @Type(() => UpdateEpisodeDto)
  @ValidateNested({ each: true })
  @Expose()
  episodes: UpdateEpisodeDto[];
}

export class TVSeriesDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Metadata about the TV series',
    type: ContentDto,
  })
  @ValidateNested()
  @Type(() => ContentDto)
  @Expose()
  metaData: ContentDto;

  @ApiProperty({
    description: 'List of season information',
    type: [SeasonDto],
  })
  @Type(() => SeasonDto)
  @ValidateNested({ each: true })
  @Expose()
  seasons: SeasonDto[];
}

export class TVSeriesSummaryDto extends OmitType(TVSeriesDto, ['seasons']) {
  @ApiProperty({
    description: 'Total number of seasons in the TV series',
    example: 42,
  })
  @IsNotEmpty()
  @Expose()
  totalSeasons: number;
}

export class TVSeriesWithNewEpisode extends OmitType(TVSeriesDto, ['seasons']) {
  @ApiProperty({
    description: 'Latest episode information',
    type: EpisodeDto,
  })
  @Type(() => EpisodeDto)
  @ValidateNested()
  @Expose()
  latestEpisode: EpisodeDto;
}
export class CreateTVSeriesDto extends OmitType(TVSeriesDto, [
  'id',
  'createdAt',
  'updatedAt',
  'seasons',
  'metaData',
]) {
  @ApiProperty({
    description: 'List of season information',
    type: [CreateSeasonDto],
  })
  @Type(() => CreateSeasonDto)
  @ValidateNested({ each: true })
  @Expose()
  seasons: CreateSeasonDto[];

  @ApiProperty({
    description: 'Metadata about the TV series',
    type: CreateContentDto,
  })
  @ValidateNested()
  @Type(() => CreateContentDto)
  @Expose()
  metaData: CreateContentDto;
}
export class UpdateTVSeriesDto extends OmitType(TVSeriesDto, [
  'id',
  'createdAt',
  'updatedAt',
  'seasons',
  'metaData',
]) {
  @ApiProperty({
    description: 'List of season information',
    type: [UpdateSeasonDto],
  })
  @Type(() => UpdateSeasonDto)
  @ValidateNested({ each: true })
  @Expose()
  seasons: UpdateSeasonDto[];
  @ApiProperty({
    description: 'Metadata about the TV series',
    type: UpdateContentDto,
  })
  @ValidateNested()
  @Type(() => UpdateContentDto)
  @Expose()
  metaData: UpdateContentDto;
}

export class TVSeriesCategory {
  @ApiProperty({
    description: 'Category ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Category Name',
    example: 'Drama',
  })
  @IsNotEmpty()
  @Expose()
  categoryName: string;

  @ApiProperty({
    description: 'Number of TV series in this category',
    example: 42,
  })
  @IsNotEmpty()
  @Expose()
  tvSeriesCount: number;
}
