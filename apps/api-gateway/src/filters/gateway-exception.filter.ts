import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { ERROR_CODE } from '@app/common/constants/global.constants';

/**
 * Gateway-specific exception filter.
 * Handles both HttpException and RpcException (from TCP microservice calls).
 * Does NOT import TypeORM — the API Gateway doesn't use a database directly.
 */
const getHttpErrorName = (status: number, defaultName: string) => {
  if (defaultName && defaultName !== 'RpcException' && defaultName !== 'Error') {
    return defaultName;
  }
  switch (status) {
    case 400: return 'BadRequestException';
    case 401: return 'UnauthorizedException';
    case 403: return 'ForbiddenException';
    case 404: return 'NotFoundException';
    case 409: return 'ConflictException';
    case 422: return 'UnprocessableEntityException';
    case 500: return 'InternalServerErrorException';
    case 503: return 'ServiceUnavailableException';
    default: return defaultName;
  }
};

@Catch()
export class GatewayExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GatewayExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Unexpected error occurred';
    let code = ERROR_CODE.UNEXPECTED_ERROR;
    let errorName = 'InternalServerErrorException';

    if (exception instanceof HttpException) {
      const res = exception.getResponse() as Record<string, any>;
      
      statusCode = exception.getStatus();
      errorName = res['error'] ?? exception.name;
      message = res['message'] ?? exception.message;
      code = res['code'] ?? (exception as any).code ?? ERROR_CODE.UNEXPECTED_ERROR;

      // Map TCP connection error that got wrapped in HttpException to 503
      if (
        code === 'ECONNREFUSED' || 
        message?.includes('ECONNREFUSED') || 
        (errorName === 'HttpException' && statusCode === 500 && (exception as any).code === 'ECONNREFUSED')
      ) {
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'A dependent service is currently unavailable or offline.';
        code = 'SERVICE_UNAVAILABLE';
        errorName = 'ServiceUnavailableException';
      }
    } else if (exception instanceof RpcException) {
      const rpcError = exception.getError();

      if (typeof rpcError === 'object' && rpcError !== null) {
        const err = rpcError as Record<string, any>;
        statusCode = err['statusCode'] ?? err['status'] ?? HttpStatus.SERVICE_UNAVAILABLE;
        message = err['message'] ?? 'Service temporarily unavailable';
        code = err['code'] ?? 'SERVICE_UNAVAILABLE';
        errorName = err['error'] ?? 'ServiceUnavailableException';
      } else {
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
        message = String(rpcError) || 'Service temporarily unavailable';
        code = 'SERVICE_UNAVAILABLE';
        errorName = 'ServiceUnavailableException';
      }
    } else if (exception instanceof Error) {
      if ((exception as any).code === 'ECONNREFUSED' || exception.message?.includes('ECONNREFUSED') || exception.message?.includes('Timeout')) {
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'A dependent service is currently unavailable.';
        code = 'SERVICE_UNAVAILABLE';
        errorName = 'ServiceUnavailableException';
      } else {
        message = exception.message;
        code = (exception as any).code ?? ERROR_CODE.UNEXPECTED_ERROR;
      }
    } else if (typeof exception === 'object' && exception !== null) {
      const err = exception as Record<string, any>;
      if (err.statusCode || err.status) {
        statusCode = err.statusCode ?? err.status;
        message = err.message ?? message;
        code = err.code ?? code;
        errorName = err.error ?? 'RpcException';
      }
    }

    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(JSON.stringify(exception, null, 2), (exception as Error)?.stack);
    }

    if (!response.headersSent) {
      response.status(statusCode).json({
        statusCode,
        error: getHttpErrorName(statusCode, errorName),
        message,
        code,
        timestamp: new Date().toISOString(),
        path: request?.url,
      });
    }
  }
}
