import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, ValidateNested } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty, OmitType } from '@nestjs/swagger';

import { ContentDto } from './content.dto';
import { VideoDto } from './video.dto';

export class MovieDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Duration of the movie in minutes',
    example: 148,
  })
  @IsNotEmpty()
  @Expose()
  @IsNumber()
  duration: number; // in minutes

  @ApiProperty({
    description: 'Metadata of the movie',
    type: ContentDto,
  })
  @ValidateNested({ each: true })
  @Type(() => ContentDto)
  @IsNotEmpty()
  @Expose()
  metaData: ContentDto;

  @ApiProperty({
    description: 'Video of the movie',
    type: VideoDto,
    required: false,
  })
  @ValidateNested()
  @Type(() => VideoDto)
  @IsOptional()
  @Expose()
  video?: VideoDto;
}

export class CreateMovieDto extends OmitType(MovieDto, ['id', 'createdAt', 'updatedAt']) {}
export class UpdateMovieDto extends OmitType(MovieDto, ['id', 'createdAt', 'updatedAt']) {}
