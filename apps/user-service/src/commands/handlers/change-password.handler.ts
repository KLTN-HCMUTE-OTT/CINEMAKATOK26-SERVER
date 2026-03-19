import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InvalidCredentialsError, UserNotFoundError, PassWordError } from '@app/common/exceptions';
import { PasswordHash } from '@app/common/utils/hash';

import { EntityUser } from '../../entities/user.entity';
import { ChangePasswordCommand } from '../impl/change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand, boolean> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<any> {
    const { userId, changePasswordDto } = command;
    const { currentPassword, newPassword, confirmPassword } = changePasswordDto;

    if (newPassword !== confirmPassword) {
      throw new PassWordError('New password and confirmation do not match');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UserNotFoundError();

    if (!user.password) {
      throw new PassWordError('Cannot change password for social login accounts');
    }

    const isCurrentPasswordValid = PasswordHash.comparePassword(currentPassword, user.password);
    console.log(isCurrentPasswordValid);
    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsError('Invalid current password');
    }

    const hashedNewPassword = PasswordHash.hashPassword(newPassword);

    return await this.userRepository.update(userId, { password: hashedNewPassword });
  }
}
