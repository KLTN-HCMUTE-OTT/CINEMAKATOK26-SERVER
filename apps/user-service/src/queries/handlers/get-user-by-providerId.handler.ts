import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotFoundError } from '@app/common/exceptions';
import { EntityUser } from '../../entities/user.entity';
import { GetUserByProviderIdQuery } from '../impl/get-user-by-providerId.query';

@QueryHandler(GetUserByProviderIdQuery)
export class GetUserByProviderIdHandler implements IQueryHandler<GetUserByProviderIdQuery, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(query: GetUserByProviderIdQuery): Promise<EntityUser> {
    const user = await this.userRepository.findOne({ where: { providerId: query.providerId } });

    if (!user) throw new UserNotFoundError();

    return user;
  }
}
