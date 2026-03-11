import { Expose } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

import { ParseJson } from '@app/common/decorators';

export class PaginationQueryDto {
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @Expose()
  @IsOptional()
  @ParseJson()
  sort?: string;

  @Expose()
  @IsOptional()
  @ParseJson()
  filter?: string;

  @Expose()
  @IsOptional()
  search?: string;

  @Expose()
  @IsOptional()
  status?: string;
}
