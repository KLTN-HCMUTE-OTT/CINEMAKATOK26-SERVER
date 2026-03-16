import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { GetUserByIdQuery } from '../impl/get-user-by-id.query';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(query: GetUserByIdQuery): Promise<EntityUser> {
    const user = await this.userRepository.findOne({ where: { id: query.id } });

    if (!user) throw new UserNotFoundError();

    return user;
  }
}
