/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { QueryFailedError, TypeORMError } from 'typeorm';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common/services/logger.service';

import { ERROR_CODE } from '../constants/global.constants';
import { ErrorResponse } from '../types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  constructor() {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const errorResponse: ErrorResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: InternalServerErrorException.name,
      message: 'Unexpected error occurred',
      timestamp: new Date().toISOString(),
      path: request.url,
      code: ERROR_CODE.UNEXPECTED_ERROR,
    };

    if (exception instanceof HttpException) {
      const res = exception.getResponse() as any;
      errorResponse.statusCode = exception.getStatus();
      errorResponse.error = res.error || exception.name;
      errorResponse.message = res.message || exception.message;
      res.code
        ? (errorResponse.code = res.code)
        : (errorResponse.code = ERROR_CODE.UNEXPECTED_ERROR);
    } else {
      switch (exception.constructor) {
        case QueryFailedError:
          errorResponse.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          errorResponse.error = ForbiddenException.name;
          errorResponse.message = exception.detail || (exception as QueryFailedError).message;
          break;
        case TypeORMError:
          errorResponse.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          errorResponse.error = ForbiddenException.name;
          errorResponse.message = exception.detail || (exception as QueryFailedError).message;
          break;
      }
    }
    if (errorResponse.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception, (exception as Error).stack);
      this.logger.error(JSON.stringify(errorResponse));
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }
}
