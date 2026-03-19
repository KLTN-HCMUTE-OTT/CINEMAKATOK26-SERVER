import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EntityUser } from '../../entities/user.entity';
import { GetAllUsersQuery } from '../impl/get-all-users.query';

@QueryHandler(GetAllUsersQuery)
export class GetAllUsersHandler implements IQueryHandler<GetAllUsersQuery> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(query: GetAllUsersQuery): Promise<{ data: EntityUser[]; total: number }> {
    const { paginationQuery, search } = query;
    const page = paginationQuery.page ?? 1;
    const limit = paginationQuery.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.userRepository.createQueryBuilder('user');

    if (search?.trim()) {
      qb.where(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    if (paginationQuery.status) {
      qb.andWhere('user.status = :status', { status: paginationQuery.status });
    }

    const [data, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }
}
