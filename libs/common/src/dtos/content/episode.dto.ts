import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty, OmitType } from '@nestjs/swagger';

import { UpdateVideoDto, VideoDto } from './video.dto';

export class EpisodeDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Episode number',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Expose()
  episodeNumber: number;

  @ApiProperty({
    description: 'Episode duration in minutes',
    example: 45,
  })
  @IsNotEmpty()
  @IsNumber()
  @Expose()
  episodeDuration: number;

  @ApiProperty({
    description: 'Episode title',
    example: 'Pilot',
  })
  @IsNotEmpty()
  @Expose()
  episodeTitle: string;

  @ApiProperty({
    description: 'List of video information',
    type: VideoDto,
  })
  @Type(() => VideoDto)
  @ValidateNested({ each: true })
  @Expose()
  video?: VideoDto;
}
export class CreateEpisodeDto extends OmitType(EpisodeDto, [
  'id',
  'createdAt',
  'updatedAt',
  'video',
]) {
  @ApiProperty({
    description: 'List of video information',
    type: UpdateVideoDto,
  })
  @Type(() => UpdateVideoDto)
  @ValidateNested({ each: true })
  @Expose()
  video?: UpdateVideoDto;
}
export class UpdateEpisodeDto extends OmitType(EpisodeDto, [
  'createdAt',
  'updatedAt',
  'video',
]) {
  @ApiProperty({
    description: 'List of video information',
    type: UpdateVideoDto,
  })
  @Type(() => UpdateVideoDto)
  @ValidateNested({ each: true })
  @Expose()
  video?: UpdateVideoDto;
}
