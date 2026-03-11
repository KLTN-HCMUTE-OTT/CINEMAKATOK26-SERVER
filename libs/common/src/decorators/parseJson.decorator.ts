/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Transform } from 'class-transformer';

import { ForbiddenException } from '@nestjs/common';

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new ForbiddenException(`Invalid JSON string: ${value}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
export const ParseJson = () => Transform(({ value }) => (value ? parseJson(value) : null));
