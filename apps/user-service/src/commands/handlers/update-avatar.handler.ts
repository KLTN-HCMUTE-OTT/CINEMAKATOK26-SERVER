import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { UpdateAvatarCommand } from '../impl/update-avatar.command';

@CommandHandler(UpdateAvatarCommand)
export class UpdateAvatarHandler implements ICommandHandler<UpdateAvatarCommand, string> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: UpdateAvatarCommand): Promise<string> {
    const { userId, avatarUrl } = command;


    const exists = await this.userRepository.existsBy({ id: userId });
    if (!exists) throw new UserNotFoundError();

    await this.userRepository.update(userId, { avatar: avatarUrl });

    return avatarUrl;
  }
}
