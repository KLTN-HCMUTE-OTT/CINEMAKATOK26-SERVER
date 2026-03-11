import * as _ from 'lodash';

import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';

import { ForbiddenException } from '@nestjs/common';

export abstract class BaseCommand {
  static create<T extends BaseCommand>(this: new (...args: any[]) => T, data: T): T {
    const convertedObject = plainToInstance<T, any>(this, JSON.parse(JSON.stringify(data)));

    const errors = validateSync(convertedObject as unknown as object);
    if (errors?.length) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const mappedErrors = _.flatten(errors.map(error => getValidationErrorConstraints(error)));
      console.log(mappedErrors);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new ForbiddenException(mappedErrors[0]);
    }

    return convertedObject;
  }
}

function getValidationErrorConstraints(error: ValidationError): string[] {
  if (error.constraints) {
    return Object.values(error.constraints);
  }
  if (error.children) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return _.flatten(error.children.map(item => getValidationErrorConstraints(item)));
  }
  return [];
}
