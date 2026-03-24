import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { EntityUser } from '../../entities/user.entity';
import { GetUsersByIdsQuery } from '../impl/get-users-by-ids.query';

@QueryHandler(GetUsersByIdsQuery)
export class GetUsersByIdsHandler implements IQueryHandler<GetUsersByIdsQuery, EntityUser[]> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(query: GetUsersByIdsQuery): Promise<EntityUser[]> {
    if (!query.ids.length) return [];
    return this.userRepository.findBy({ id: In(query.ids) });
  }
}
