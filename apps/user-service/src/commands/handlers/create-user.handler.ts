import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EmailAlreadyExistsError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { CreateUserCommand } from '../impl/create-user.command';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: CreateUserCommand): Promise<EntityUser> {
    const existing = await this.userRepository.findOne({
      where: { email: command.email.toLowerCase() },
    });

    if (existing) throw new EmailAlreadyExistsError();

    const user = this.userRepository.create({
      ...command,
      email: command.email.toLowerCase(),
    });

    return this.userRepository.save(user);
  }
}
