import { Expose, Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class ReviewDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Content that was reviewed',
    example: 'Great movie with stunning visuals and a compelling story.',
  })
  @Expose()
  @IsString()
  contentReviewed: string;

  @ApiProperty({
    description: 'Rating given by the user',
    example: 4,
  })
  @Expose()
  @IsNumber()
  rating: number;

  @ApiProperty({
    description: 'Status of the review',
    enum: REVIEW_STATUS,
  })
  @Expose()
  @IsOptional()
  status: REVIEW_STATUS;

  @ApiProperty({
    description: 'ID of the content being reviewed',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  @Transform(({ obj }) => obj.content?.id || obj.contentId)
  contentId: string;

  @ApiProperty({
    description: 'Name of the user who made the review',
    example: 'Jane Smith',
  })
  @Expose()
  @IsString()
  @Transform(({ obj }) => obj.user?.name || obj.name)
  name: string;

  @ApiProperty({
    description: 'Avatar URL of the user who made the review',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @Expose()
  @Transform(({ obj }) => {
    if (obj.user && obj.user.avatar) {
      return obj.user.avatar;
    }
    return obj.avatar || null;
  })
  avatar: string | null;

  @ApiProperty({
    description: 'ID of the user who made the review',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  @Transform(({ obj }) => obj.user?.id || obj.userId)
  userId: string;
}

export class CreateReviewDto extends OmitType(ReviewDto, [
  'id',
  'createdAt',
  'updatedAt',
  'name',
  'avatar',
  'userId',
]) {}

export class UpdateReviewDto extends OmitType(ReviewDto, [
  'createdAt',
  'updatedAt',
  'name',
  'avatar',
  'userId',
]) {}
