import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';

export class TagDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'trending',
  })
  @IsString()
  @Expose()
  tagName: string;
}

export class CreateTagDto extends OmitType(TagDto, ['id', 'createdAt', 'updatedAt']) {}

export class UpdateTagDto extends PickType(TagDto, ['id', 'tagName']) {}
