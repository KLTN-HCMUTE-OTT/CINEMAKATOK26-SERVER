import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { GetUserByEmailQuery } from '../impl/get-user-by-email.query';

@QueryHandler(GetUserByEmailQuery)
export class GetUserByEmailHandler implements IQueryHandler<GetUserByEmailQuery, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(query: GetUserByEmailQuery): Promise<EntityUser> {
    const user = await this.userRepository.findOne({
      where: { email: query.email.toLowerCase() },
    });

    if (!user) throw new UserNotFoundError();

    return user;
  }
}
