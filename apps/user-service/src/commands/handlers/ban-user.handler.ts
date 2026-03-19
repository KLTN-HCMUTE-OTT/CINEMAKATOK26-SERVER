import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

import {
  UserNotFoundError,
  EmailSendingFailedError,
} from '@app/common/exceptions';
import { USER_STATUS } from '@app/common/enums/global.enum';

import { EntityUser } from '../../entities/user.entity';
import { BanUserCommand } from '../impl/ban-user.command';

@CommandHandler(BanUserCommand)
export class BanUserHandler implements ICommandHandler<BanUserCommand, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async execute(command: BanUserCommand): Promise<EntityUser> {
    const user = await this.userRepository.findOne({ where: { id: command.userId } });
    if (!user) throw new UserNotFoundError();

    const bannedUntil = new Date();
    bannedUntil.setDate(bannedUntil.getDate() + command.durationDays);

    user.isBanned = true;
    user.banReason = command.banReason;
    user.bannedUntil = bannedUntil;
    user.status = USER_STATUS.BANNED;

    const savedUser = await this.userRepository.save(user);

    // Notify user by email — fire-and-forget (but await publishing)
    try {
      await firstValueFrom(
        this.notificationClient.emit('notification.sendBanNotification', {
          email: user.email,
          userName: user.name,
          banReason: command.banReason,
          bannedUntil,
        }),
      );
    } catch (error) {
      console.error('Failed to emit ban notification:', error);
      throw new EmailSendingFailedError();
    }

    return savedUser;
  }
}
