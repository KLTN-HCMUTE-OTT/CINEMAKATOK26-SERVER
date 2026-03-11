import { HttpException, HttpExceptionOptions } from '@nestjs/common';

export class BadRequestException extends HttpException {
  constructor(message: string, code: string = 'BadRequest', options?: HttpExceptionOptions) {
    const response = {
      message,
      code: code,
    };
    super(response, 400, options);
  }
}
