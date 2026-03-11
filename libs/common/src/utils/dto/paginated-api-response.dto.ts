import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { ApiResponse } from './api-response.dto';

export class PaginationMeta {
  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  itemCount: number;
  @ApiProperty()
  itemsPerPage: number;
  @ApiProperty()
  totalPages: number;
  @ApiProperty()
  currentPage: number;
}

export abstract class PaginatedApiResponse<T> extends ApiResponse<T[]> {
  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;
  @ApiProperty({ type: [Object] })
  declare data: T[];
}

export function PaginatedApiResponseDto<T>(dto: Type<T>) {
  abstract class Host<T> extends PaginatedApiResponse<T> {
    @ApiProperty({
      type: [dto],
    })
    declare data: T[];
  }
  Object.defineProperty(Host, 'name', {
    writable: false,
    value: `${dto.name}PaginatedResponseDto`,
  });
  return Host;
}
