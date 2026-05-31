import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { UpdateContentPreferencesCommand } from '../impl/update-content-preferences.command';

@CommandHandler(UpdateContentPreferencesCommand)
export class UpdateContentPreferencesHandler
  implements ICommandHandler<UpdateContentPreferencesCommand, EntityUser>
{
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: UpdateContentPreferencesCommand): Promise<EntityUser> {
    const { userId, preferences } = command;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UserNotFoundError();

    user.contentPreferences = {
      ...user.contentPreferences,
      ...preferences,
    };

    return this.userRepository.save(user);
  }
}
