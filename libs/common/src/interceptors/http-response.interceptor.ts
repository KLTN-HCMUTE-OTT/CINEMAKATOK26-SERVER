/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Observable, map } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { ApiResponse } from '../utils/dto';

@Injectable()
export class HttpResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map(data => {
        // If data has RspCode (VNPAY response format), return it directly to bypass wrapping
        if (data && typeof data === 'object' && 'RspCode' in data) {
          return data;
        }
        return {
          statusCode: context.switchToHttp().getResponse().statusCode,
          message: data?.message ?? 'Success',
          data: data?.data ?? null,
          meta: data?.meta ?? undefined,
        };
      }),
    );
  }
}
