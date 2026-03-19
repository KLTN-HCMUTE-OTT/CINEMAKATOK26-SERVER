import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError, NotFoundResourceError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { DeleteAvatarCommand } from '../impl/delete-avatar.command';

@CommandHandler(DeleteAvatarCommand)
export class DeleteAvatarHandler implements ICommandHandler<DeleteAvatarCommand, boolean> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: DeleteAvatarCommand): Promise<boolean> {
    const { userId } = command;
    console.log('userId', userId)

    const user = await this.userRepository.findOne({ where: { id: userId } });
    console.log('user', user)
    if (!user) throw new UserNotFoundError();

    if (!user.avatar) {
      throw new NotFoundResourceError('No avatar to delete');
    }

    await this.userRepository.update(userId, { avatar: null });
    return true;
  }
}
