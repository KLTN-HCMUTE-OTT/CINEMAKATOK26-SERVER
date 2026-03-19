import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Logger } from '@nestjs/common';

import { USER_STATUS } from '@app/common/enums/global.enum';
import { EntityUser } from '../../entities/user.entity';
import { AutoUnbanUsersCommand } from '../impl/auto-unban-users.command';

@CommandHandler(AutoUnbanUsersCommand)
export class AutoUnbanUsersHandler implements ICommandHandler<AutoUnbanUsersCommand, number> {
  private readonly logger = new Logger(AutoUnbanUsersHandler.name);

  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(): Promise<number> {
    const now = new Date();

    const result = await this.userRepository.update(
      {
        isBanned: true,
        bannedUntil: LessThanOrEqual(now),
      },
      {
        isBanned: false,
        banReason: null,
        bannedUntil: null,
        status: USER_STATUS.ACTIVATED,
      },
    );

    const affectedCount = result.affected || 0;
    if (affectedCount > 0) {
      this.logger.log(`Successfully auto-unbanned ${affectedCount} users`);
    }

    return affectedCount;
  }
}
