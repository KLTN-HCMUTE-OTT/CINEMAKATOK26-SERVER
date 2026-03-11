import { ApiResponse } from './api-response.dto';
import { PaginatedApiResponse } from './paginated-api-response.dto';

type ResponseParams<T> = {
  data: T;
  message?: string;
  statusCode?: number;
};

type PaginatedResponseParams<T> = {
  data: T[];
  totalItems: number;
  currentPage?: number;
  itemsPerPage?: number;
  message?: string;
  statusCode?: number;
};

export class ResponseBuilder {
  static createResponse<T>({
    data,
    message = 'Success',
    statusCode = 200,
  }: ResponseParams<T>): ApiResponse<T> {
    return {
      statusCode,
      message,
      data,
    };
  }

  static createPaginatedResponse<T>({
    data,
    totalItems,
    currentPage,
    itemsPerPage,
    message = 'Success',
    statusCode = 200,
  }: PaginatedResponseParams<T>): PaginatedApiResponse<T> {
    const totalPages = Math.ceil(totalItems / (itemsPerPage || 1));
    return {
      statusCode,
      message,
      data,
      meta: {
        totalItems: totalItems || 0,
        itemCount: data.length,
        itemsPerPage: itemsPerPage || data.length,
        totalPages: totalPages || 1,
        currentPage: currentPage || 1,
      },
    };
  }
}
