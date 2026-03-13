import { Catch, RpcExceptionFilter, HttpException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

/**
 * Catches HttpExceptions thrown inside microservices and converts them into
 * plain error payloads for transport over TCP.
 *
 * NOTE: We throw the plain object — NOT new RpcException() — for the same
 * reason as RpcDomainExceptionFilter: wrapping in RpcException inside the
 * filter causes NestJS to re-process it and replace it with a generic error.
 */
@Catch(HttpException)
export class HttpToRpcExceptionFilter implements RpcExceptionFilter<HttpException> {
  catch(exception: HttpException): Observable<never> {
    const res = exception.getResponse();
    const statusCode = exception.getStatus();

    let payload: Record<string, any>;
    if (typeof res === 'object' && res !== null) {
      payload = { ...res } as Record<string, any>;
      if (!payload['statusCode'] && !payload['status']) {
        payload['statusCode'] = statusCode;
      }
      if (!payload['error']) {
        payload['error'] = exception.name;
      }
    } else {
      payload = {
        statusCode,
        message: res,
        error: exception.name,
      };
    }

    return throwError(() => payload);
  }
}
