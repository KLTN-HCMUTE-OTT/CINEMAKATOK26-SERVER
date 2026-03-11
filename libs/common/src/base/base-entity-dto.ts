import { Expose } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export abstract class BaseEntityDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique identifier of the entity',
  })
  @IsUUID()
  @IsOptional()
  @Expose()
  id!: string;

  @ApiProperty({
    example: '2023-10-01T12:00:00Z',
    description: 'Creation date of the entity',
  })
  @IsOptional()
  @Expose()
  readonly createdAt!: Date;
  @ApiProperty({
    example: '2023-10-01T12:00:00Z',
    description: 'Last update date of the entity',
  })
  @IsOptional()
  @Expose()
  readonly updatedAt!: Date;
}
