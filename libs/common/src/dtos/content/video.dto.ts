import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ToS3FileKey } from '@app/common/decorators/toS3FileKey.decorator';
import { RESOLUTION, VIDEO_STATUS } from '@app/common/enums/global.enum';
import { getConfig } from '@app/common/utils/get-config';
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';

const bucketUrl = getConfig('aws.s3BucketUrl', 'https://your-default-bucket-url.com/');
export class VideoDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Video URL',
    example: '/uploads/video-123/stream_0/playlist.m3u8',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  @ToS3FileKey(bucketUrl)
  videoUrl: string;

  @ApiProperty({
    description: 'Video processing status',
    example: VIDEO_STATUS.PROCESSING,
    enum: VIDEO_STATUS,
  })
  @IsEnum(VIDEO_STATUS)
  @IsOptional()
  @Expose()
  status?: VIDEO_STATUS;

  @ApiProperty({
    description: 'Thumbnail URL',
    example: '/uploads/video-123/thumbnail.jpg',
  })
  @IsString()
  @IsOptional()
  @Expose()
  thumbnailUrl?: string;

  @ApiProperty({
    description: 'Sprite image URLs',
    example: ['https://r2.example.com/videos/123/sprites/sprite_0.jpg'],
    type: [String],
  })
  @IsOptional()
  @Expose()
  sprites?: string[];

  @ApiProperty({
    description: 'VTT file URLs',
    example: ['https://r2.example.com/videos/123/sprites/sprite_0.vtt'],
    type: [String],
  })
  @IsOptional()
  @Expose()
  vttFiles?: string[];
}
export interface AbsContentPathParams {
  s3Key: string;
}

export class CreateVideoDto extends OmitType(VideoDto, ['id', 'createdAt', 'updatedAt']) {}
export class UpdateVideoDto extends PickType(VideoDto, [
  'id',
  'videoUrl',
  'status',
  'thumbnailUrl',
  'sprites',
  'vttFiles',
]) {}
