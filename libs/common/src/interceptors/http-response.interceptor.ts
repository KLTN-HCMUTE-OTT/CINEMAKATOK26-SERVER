import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';

import { ApiResponse } from '../utils/dto';
import { SKIP_TRANSFORM } from '../decorators/skip-transform.decorator';

@Injectable()
export class HttpResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

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
