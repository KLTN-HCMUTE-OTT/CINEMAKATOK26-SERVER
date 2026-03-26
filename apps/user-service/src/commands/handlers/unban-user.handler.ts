import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

import { UserNotFoundError, EmailSendingFailedError } from '@app/common/exceptions';
import { USER_STATUS } from '@app/common/enums/global.enum';

import { EntityUser } from '../../entities/user.entity';
import { UnbanUserCommand } from '../impl/unban-user.command';

@CommandHandler(UnbanUserCommand)
export class UnbanUserHandler implements ICommandHandler<UnbanUserCommand, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async execute(command: UnbanUserCommand): Promise<EntityUser> {
    const user = await this.userRepository.findOne({ where: { id: command.userId } });
    if (!user) throw new UserNotFoundError();

    user.isBanned = false;
    user.banReason = null;
    user.bannedUntil = null;
    user.status = USER_STATUS.ACTIVATED;

    const savedUser = await this.userRepository.save(user);

    // Notify user by email
    try {
      await firstValueFrom(
        this.notificationClient.emit('notification.sendUnbanNotification', {
          email: user.email,
          userName: user.name,
        }),
      );
    } catch (error) {
      console.error('Failed to emit unban notification:', error);
      // We don't throw here to avoid rolling back the unban, but we log it
    }

    return savedUser;
  }
}
