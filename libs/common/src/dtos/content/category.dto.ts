import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';

export class CategoryDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Name of the category',
    example: 'Science Fiction',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  categoryName: string;
}

export class CreateCategoryDto extends OmitType(CategoryDto, ['id', 'createdAt', 'updatedAt']) {}

export class UpdateCategoryDto extends PickType(CategoryDto, ['id', 'categoryName']) {}
