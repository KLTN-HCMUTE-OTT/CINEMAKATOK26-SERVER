import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class NewsDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Title of the news article',
    example: 'Exciting Updates in the Film Industry',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Summary of the news article',
    example: 'A brief overview of the latest developments in cinema.',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiProperty({
    description: 'HTML content of the news article',
    example: '<p>This is the full content of the news article.</p>',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  content_html: string;
  @ApiProperty({
    description: 'Cover image URL of the news article',
    example: 'https://example.com/cover-image.jpg',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  cover_image: string;

  @ApiProperty({
    description: 'Category of the news article',
    example: ['Entertainment', 'Film'],
  })
  @Expose()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  category: string[];

  @ApiProperty({
    description: 'Name of the news author',
    example: 'Jane Smith',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  author_name: string;

  @ApiProperty({
    description: 'Avatar URL of the news author',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  author_avatar: string | null;
}

export class CreateNewsDto extends OmitType(NewsDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

export class UpdateNewsDto extends OmitType(NewsDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}
