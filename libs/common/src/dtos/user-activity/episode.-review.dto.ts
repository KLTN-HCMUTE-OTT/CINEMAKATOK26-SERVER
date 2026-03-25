import { Expose, Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class EpisodeReviewDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Episode that was reviewed',
    example: 'Great movie with stunning visuals and a compelling story.',
  })
  @Expose()
  @IsString()
  contentReviewed: string;

  @ApiProperty({
    description: 'ID of the episode being reviewed',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  @Transform(({ obj }) => obj.episode?.id || obj.episodeId)
  episodeId: string;

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
    description: 'Status of the review',
    example: REVIEW_STATUS.ACTIVE,
    enum: REVIEW_STATUS,
  })
  @Expose()
  @IsOptional()
  status: REVIEW_STATUS;
}

export class CreateEpisodeReviewDto extends OmitType(EpisodeReviewDto, [
  'id',
  'createdAt',
  'updatedAt',
  'name',
  'avatar',
]) {}

export class UpdateEpisodeReviewDto extends OmitType(EpisodeReviewDto, [
  'id',
  'createdAt',
  'updatedAt',
  'name',
  'avatar',
]) {}
