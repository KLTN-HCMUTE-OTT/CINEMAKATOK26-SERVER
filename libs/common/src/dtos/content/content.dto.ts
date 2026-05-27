import { Expose, Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidateNested,
} from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ACCESS_TIER, MaturityRating } from '@app/common/enums/global.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';

import { ContentType } from 'apps/content-service/src/entities/content.entity';
import { ActorDto, UpdateActorDto } from './actor.dto';
import { CategoryDto, UpdateCategoryDto } from './category.dto';
import { DirectorDto, UpdateDirectorDto } from './director.dto';
import { TagDto, UpdateTagDto } from './tag.dto';

export class ContentDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Type of the content',
    example: ContentType.MOVIE,
    enum: ContentType,
  })
  @IsEnum(ContentType)
  @IsNotEmpty()
  @Expose()
  type: ContentType;

  @ApiProperty({
    description: 'Title of the content',
    example: 'Inception',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  title: string;

  @ApiProperty({
    description: 'Description of the content',
    example: 'A mind-bending thriller',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  description: string;

  @ApiProperty({
    description: 'Release date of the content',
    example: '2010-07-16',
  })
  @Transform(({ value }) => {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      return value.split('T')[0];
    }
    return value;
  })
  @IsDateString()
  @IsNotEmpty()
  @Expose()
  releaseDate: string;

  @ApiProperty({
    description: 'Maturity rating of the content',
    example: MaturityRating.PG13,
    enum: MaturityRating,
  })
  @IsEnum(MaturityRating)
  @IsNotEmpty()
  @Expose()
  maturityRating: MaturityRating;

  @ApiProperty({
    description: 'Thumbnail image URL of the content',
    example: 'https://example.com/thumbnail.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  thumbnail: string;

  @ApiProperty({
    description: 'Banner image URL of the content',
    example: 'https://example.com/banner.jpg',
  })
  @IsString()
  @IsOptional()
  @Expose()
  banner?: string;

  @ApiProperty({
    description: 'Trailer video URL of the content',
    example: 'https://example.com/trailer.mp4',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  trailer: string;

  @ApiProperty({
    description: 'Average rating of the content',
    example: 8.5,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Expose()
  avgRating: number;

  @ApiProperty({
    description: 'View count of the content',
    example: 1000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Expose()
  viewCount: number;

  @ApiProperty({
    description: 'IMDB rating of the content',
    example: 8.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Expose()
  imdbRating: number;

  @ApiProperty({
    description: 'Access tier of the content',
    enum: ACCESS_TIER,
    required: false,
  })
  @IsOptional()
  @IsEnum(ACCESS_TIER)
  @Expose()
  accessTier: ACCESS_TIER;

  @ApiProperty({
    description: 'Categories of the content',
    type: [CategoryDto],
  })
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  @Expose()
  categories: CategoryDto[];

  @ApiProperty({
    description: 'Tags of the content',
    type: [TagDto],
  })
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  @Expose()
  tags: TagDto[];

  @ApiProperty({
    description: 'Actors of the content',
    type: [ActorDto],
  })
  @ValidateNested({ each: true })
  @Type(() => ActorDto)
  @Expose()
  actors: ActorDto[];

  @ApiProperty({
    description: 'Directors of the content',
    type: [DirectorDto],
  })
  @ValidateNested({ each: true })
  @Type(() => DirectorDto)
  @Expose()
  directors: DirectorDto[];
}

export class CreateContentDto extends OmitType(ContentDto, [
  'id',
  'createdAt',
  'updatedAt',
  'actors',
  'directors',
  'tags',
  'categories',
  'viewCount',
]) {
  @ApiProperty({
    description: 'Categories of the content',
    type: [UpdateCategoryDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateCategoryDto)
  @Expose()
  categories: UpdateCategoryDto[];

  @ApiProperty({
    description: 'Tags of the content',
    type: [UpdateTagDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateTagDto)
  @Expose()
  tags: UpdateTagDto[];

  @ApiProperty({
    description: 'Actors of the content',
    type: [UpdateActorDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateActorDto)
  @Expose()
  actors: UpdateActorDto[];
  @ApiProperty({
    description: 'Directors of the content',
    type: [UpdateDirectorDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateDirectorDto)
  @Expose()
  directors: UpdateDirectorDto[];
}
export class UpdateContentDto extends OmitType(ContentDto, [
  'createdAt',
  'updatedAt',
  'actors',
  'directors',
  'tags',
  'categories',
]) {
  @ApiProperty({
    description: 'Categories of the content',
    type: [UpdateCategoryDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateCategoryDto)
  @Expose()
  categories: UpdateCategoryDto[];

  @ApiProperty({
    description: 'Tags of the content',
    type: [UpdateTagDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateTagDto)
  @Expose()
  tags: UpdateTagDto[];

  @ApiProperty({
    description: 'Actors of the content',
    type: [UpdateActorDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateActorDto)
  @Expose()
  actors: UpdateActorDto[];
  @ApiProperty({
    description: 'Directors of the content',
    type: [UpdateDirectorDto],
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateDirectorDto)
  @Expose()
  directors: UpdateDirectorDto[];
}

export enum ContentSortBy {
  VIEWS = 'views',
  TITLE = 'title',
  DATE = 'date',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ContentFilterDto {
  @ApiProperty({
    description: 'Content type (MOVIE or TVSERIES)',
    enum: ContentType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @ApiProperty({
    description: 'Array of tag IDs to filter by',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiProperty({
    description: 'Array of category IDs to filter by',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiProperty({
    description: 'Array of actor IDs to filter by',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  actorIds?: string[];

  @ApiProperty({
    description: 'Array of director IDs to filter by',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  directorIds?: string[];

  @ApiProperty({
    description: 'Release year to filter by',
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  year?: number;

  @ApiProperty({
    description: 'Search by title',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Sort by field',
    enum: ContentSortBy,
    default: ContentSortBy.DATE,
    required: false,
  })
  @IsOptional()
  @IsEnum(ContentSortBy)
  sortBy?: ContentSortBy = ContentSortBy.DATE;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;

  @ApiProperty({
    description: 'Page number for pagination',
    type: Number,
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    type: Number,
    minimum: 1,
    maximum: 50,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;
}
