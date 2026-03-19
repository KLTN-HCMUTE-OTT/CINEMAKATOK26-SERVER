import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError } from '@app/common/exceptions';
import { USER_STATUS } from '@app/common/enums/global.enum';

import { EntityUser } from '../../entities/user.entity';
import { UnbanUserCommand } from '../impl/unban-user.command';

@CommandHandler(UnbanUserCommand)
export class UnbanUserHandler implements ICommandHandler<UnbanUserCommand, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: UnbanUserCommand): Promise<EntityUser> {
    const user = await this.userRepository.findOne({ where: { id: command.userId } });
    if (!user) throw new UserNotFoundError();

    user.isBanned = false;
    user.banReason = null;
    user.bannedUntil = null;
    user.status = USER_STATUS.ACTIVATED;

    return this.userRepository.save(user);
  }
}
