/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Observable, tap } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';

type HttpLoggingInterceptorParams = {
  logLevel?: 'log' | 'error' | 'warn' | 'debug' | 'verbose';
};

export function HttpLoggingInterceptor({ logLevel = 'debug' }: HttpLoggingInterceptorParams) {
  @Injectable()
  class Interceptor implements NestInterceptor {
    readonly logger = new Logger(HttpLoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const now = Date.now();
      return next.handle().pipe(
        tap(() => {
          const request = context.switchToHttp().getRequest();
          const { method, url } = request;
          const operationId = context.getHandler().name;
          const controller = context.getClass().name;
          this.logger[logLevel](
            `${controller} ${operationId} - ${method} ${url} - ${Date.now() - now}ms`,
          );
        }),
      );
    }
  }
  return new Interceptor();
}
