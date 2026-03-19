import { PaginationQueryDto } from '@app/common/utils/dto';

export class GetAllUsersQuery {
  constructor(
    public readonly paginationQuery: PaginationQueryDto,
    public readonly search?: string,
  ) {}
}
