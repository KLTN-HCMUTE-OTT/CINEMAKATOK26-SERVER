import { Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsString, isEmpty } from 'class-validator';

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
    description: 'Name of the user who made the review',
    example: 'Jane Smith',
  })
  @Expose()
  @IsString()
  @Transform(({ obj }) => {
    if (obj.author && !isEmpty(obj.author.name)) {
      return obj.author.name;
    }
    return obj.name || 'Unknown';
  })
  name: string;

  @ApiProperty({
    description: 'Avatar URL of the user who made the review',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @Expose()
  @Transform(({ obj }) => {
    if (obj.author && obj.author.avatar) {
      return obj.author.avatar;
    }
    return obj.avatar || null;
  })
  avatar: string | null;
}

export class CreateNewsDto extends OmitType(NewsDto, [
  'id',
  'createdAt',
  'updatedAt',
  'name',
  'avatar',
]) {}

export class UpdateNewsDto extends OmitType(NewsDto, [
  'id',
  'createdAt',
  'updatedAt',
  'name',
  'avatar',
]) {}
