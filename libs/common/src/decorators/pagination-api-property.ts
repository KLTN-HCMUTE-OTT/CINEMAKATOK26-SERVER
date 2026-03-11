/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

import { PaginationQueryDto } from '../utils/dto/pagination-query.dto';

export function ApiPaginationQueries() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      description: 'Page number',
      type: PaginationQueryDto['page'],
      default: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'items per page',
      type: PaginationQueryDto['limit'],
      default: 10,
    }),
    ApiQuery({
      name: 'sort',
      required: false,
      description: 'Sort json',
      type: PaginationQueryDto['sort'],
      example: '{ "createdAt": "DESC" }',
    }),
    ApiQuery({
      name: 'filter',
      required: false,
      description: 'Filter json',
      type: PaginationQueryDto['filter'],
      example: '{ "username": "john_doe" }',
    }),
    ApiQuery({
      name: 'search',
      required: false,
      description: 'Full text search',
      type: PaginationQueryDto['search'],
      example: 'john_doe',
    }),
  );
}
