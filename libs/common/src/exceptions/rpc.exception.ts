import { catchError, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * RxJS Operator that catches raw TCP Microservice errors from ClientProxy requests
 * and maps them into standard standard NestJS HttpExceptions so the Gateway 
 * returns perfectly formatted REST API responses to the client.
 */
export const catchRpcError = () => catchError((error) => {
  const err = error as any;
  const statusCode = err.statusCode || err.status || HttpStatus.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';
  const code = err.code || 'UNEXPECTED_ERROR';
  
  const getHttpErrorName = (status: number) => {
    switch (status) {
      case 400: return 'BadRequestException';
      case 401: return 'UnauthorizedException';
      case 403: return 'ForbiddenException';
      case 404: return 'NotFoundException';
      case 409: return 'ConflictException';
      case 422: return 'UnprocessableEntityException';
      default: return 'InternalServerErrorException';
    }
  };

  return throwError(() => new HttpException(
    {
      statusCode,
      message,
      code,
      error: err.error || getHttpErrorName(statusCode),
    },
    statusCode
  ));
});
