import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * LoggingInterceptor
 *
 * Emits structured JSON-compatible log entries for every inbound request
 * and outbound response, including the correlation ID and saga ID (when present).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<any>();

    // Resolve correlation ID from header or generate a new one using Node crypto
    const correlationId =
      req?.headers?.['x-correlation-id'] ??
      req?.headers?.['X-Correlation-ID'] ??
      randomUUID();

    const start = Date.now();
    const method = req?.method ?? 'UNKNOWN';
    const url = req?.url ?? '';

    return new Observable((subscriber) => {
      this.logger.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
            service: 'payment-service',
            correlationId,
            message: `→ ${method} ${url}`,
          }),
        );

        next.handle().pipe(
          tap({
            next: () => {
              this.logger.log(
                JSON.stringify({
                  timestamp: new Date().toISOString(),
                  level: 'info',
                  service: 'payment-service',
                  correlationId,
                  message: `← ${method} ${url} [${Date.now() - start}ms]`,
                }),
              );
            },
            error: (err) => {
              this.logger.error(
                JSON.stringify({
                  timestamp: new Date().toISOString(),
                  level: 'error',
                  service: 'payment-service',
                  correlationId,
                  message: `← ${method} ${url} ERROR: ${err.message}`,
                }),
              );
            },
          }),
        ).subscribe(subscriber);
    });
  }
}
