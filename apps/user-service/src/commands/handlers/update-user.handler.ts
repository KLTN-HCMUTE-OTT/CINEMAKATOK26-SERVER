import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { UpdateUserCommand } from '../impl/update-user.command';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: UpdateUserCommand): Promise<EntityUser> {
    const { userId, ...updateData } = command;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UserNotFoundError();

    Object.assign(user, updateData);

    return this.userRepository.save(user);
  }
}
