import { IQuery } from '@nestjs/cqrs';

export class GetUserByProviderIdQuery implements IQuery {
  constructor(public readonly providerId: string) {}
}
