import { IQuery } from '@nestjs/cqrs';

export class GetUsersByIdsQuery implements IQuery {
  constructor(public readonly ids: string[]) {}
}
