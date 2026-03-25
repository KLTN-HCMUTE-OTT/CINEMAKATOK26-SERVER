import { Expose, Transform, Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class ReviewReplyDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Content of the reply',
    example: 'Thank you for your feedback!',
  })
  @Expose()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Status of the reply',
    enum: REVIEW_STATUS,
  })
  @Expose()
  @IsOptional()
  status: REVIEW_STATUS;

  @ApiProperty({
    description: 'ID of the review being replied to',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsUUID()
  @Transform(({ obj }) => obj.review?.id || obj.reviewId || null)
  reviewId: string | null;

  @ApiProperty({
    description: 'ID of the episode review being replied to',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsUUID()
  @Transform(({ obj }) => obj.episodeReview?.id || obj.episodeReviewId || null)
  episodeReviewId: string | null;

  @ApiProperty({
    description: 'Name of the user who made the reply',
    example: 'John Doe',
  })
  @Expose()
  @IsString()
  @Transform(({ obj }) => obj.user?.name || obj.name)
  name: string;

  @ApiProperty({
    description: 'Avatar URL of the user who made the reply',
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
    description: 'ID of the user who made the reply',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  @Transform(({ obj }) => obj.user?.id || obj.userId)
  userId: string;

  @ApiProperty({
    description: 'ID of the parent reply if this is a nested reply',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @Transform(({ obj }) => obj.parentReply?.id || obj.parentReplyId || null)
  parentReplyId: string | null;

  @ApiProperty({
    description: 'Number of child replies',
    example: 5,
  })
  @Expose()
  @Transform(({ obj }) => obj.replyCount ?? 0)
  replyCount: number;
}

export class CreateReviewReplyDto {
  @ApiProperty({
    description: 'Content of the reply',
    example: 'Thank you for your feedback!',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  content: string;

  @ApiProperty({
    description:
      'ID of the review being replied to (must provide either reviewId or episodeReviewId)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  reviewId?: string;

  @ApiProperty({
    description:
      'ID of the episode review being replied to (must provide either reviewId or episodeReviewId)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  episodeReviewId?: string;

  @ApiProperty({
    description: 'ID of the parent reply if replying to another reply',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentReplyId?: string;
}

export class UpdateReviewReplyDto {
  @ApiProperty({
    description: 'Content of the reply',
    example: 'Thank you for your feedback!',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  content: string;
}
