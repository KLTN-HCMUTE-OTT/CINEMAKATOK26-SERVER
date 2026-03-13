import { Catch, RpcExceptionFilter, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { DomainError } from '../exceptions/domain.error';

/**
 * Catches DomainErrors thrown by the service layer and serializes them into
 * plain error payloads for transport over TCP.
 *
 * Error contract sent to the gateway:
 *   { statusCode, code, message, error, retryable }
 *
 * NOTE: We throw the plain object — NOT new RpcException() — because NestJS
 * re-processes any exception emitted from a filter's Observable. Wrapping in
 * RpcException here would cause it to fall into RpcExceptionsHandler.handleUnknownError()
 * and be replaced with a generic "Internal server error".
 * The gateway's catchRpcError() operator wraps it in RpcException on its side.
 */
@Catch(DomainError)
export class RpcDomainExceptionFilter implements RpcExceptionFilter<DomainError> {
  private readonly logger = new Logger(RpcDomainExceptionFilter.name);

  catch(exception: DomainError): Observable<never> {
    this.logger.warn(
      `DomainError [${exception.code}] status=${exception.httpStatus}`,
    );

    return throwError(() => ({
      statusCode: exception.httpStatus,
      code: exception.code,
      message: exception.message,
      error: exception.name,
    }));
  }
}
