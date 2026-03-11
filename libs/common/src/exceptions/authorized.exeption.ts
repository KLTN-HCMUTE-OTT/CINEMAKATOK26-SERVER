import { HttpException, HttpExceptionOptions } from '@nestjs/common';

export class UnauthorizedException extends HttpException {
  constructor(message: string, code: string = 'Unauthorized', options: HttpExceptionOptions) {
    const response = {
      message,
      code: code,
    };
    super(response, 401, options);
  }
}
