import {
  ArgumentMetadata,
  BadRequestException,
  HttpStatus,
  Injectable,
  ValidationError,
} from '@nestjs/common';
import { Type } from '@nestjs/common/interfaces';
import * as pipes from '@nestjs/common/pipes';

import { ERROR_CODE } from '../constants/global.constants';

export const validationOptions: pipes.ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  exceptionFactory: (errors: ValidationError[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const errorFields = generateErrorFields(errors);
    return new BadRequestException({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      error: errorFields,
      code: ERROR_CODE.INVALID_BODY,
      message: 'Your input contains invalid data. Please check the fields and try again.',
    });
  },
};

export const validationPipe = new pipes.ValidationPipe(validationOptions);

@Injectable()
export class AbstractValidationPipe extends pipes.ValidationPipe {
  constructor(
    options: pipes.ValidationPipeOptions,
    private readonly targetType: {
      body?: Type<any>;
      query?: Type<any>;
      params?: Type<any>;
      custom?: Type<any>;
    },
  ) {
    super(options);
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const targetType = this.targetType[metadata.type];
    if (!targetType) {
      return super.transform(value, metadata);
    }
    return super.transform(value, {
      ...metadata,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      metatype: targetType,
    });
  }
}
function generateErrorFields(errors: ValidationError[]) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return errors.reduce(
    (accumulator, currentValue) => ({
      ...accumulator,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      [currentValue.property]:
        (currentValue.children?.length ?? 0) > 0
          ? generateErrorFields(currentValue.children ?? [])
          : Object.values(currentValue.constraints ?? {}).join(', '),
    }),
    {},
  );
}
