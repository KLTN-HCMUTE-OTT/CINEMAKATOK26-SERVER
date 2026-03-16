import { Controller } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateUserCommand } from './commands/impl/create-user.command';
import { UpdatePasswordCommand } from './commands/impl/update-password.command';
import { UpdateUserCommand } from './commands/impl/update-user.command';
import { GetUserByEmailQuery } from './queries/impl/get-user-by-email.query';
import { GetUserByIdQuery } from './queries/impl/get-user-by-id.query';

@Controller()
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @MessagePattern({ cmd: 'user.find-by-email' })
  findByEmail(@Payload() payload: { email: string }) {
    return this.queryBus.execute(new GetUserByEmailQuery(payload.email));
  }

  @MessagePattern({ cmd: 'user.getProfile' })
  getProfile(@Payload() payload: { userId: string }) {
    return this.queryBus.execute(new GetUserByIdQuery(payload.userId));
  }

  @MessagePattern({ cmd: 'user.getById' })
  getById(@Payload() payload: { id: string }) {
    return this.queryBus.execute(new GetUserByIdQuery(payload.id));
  }

  @MessagePattern({ cmd: 'user.updateProfile' })
  updateProfile(@Payload() payload: { userId: string; [key: string]: any }) {
    return this.commandBus.execute(UpdateUserCommand.create(payload as UpdateUserCommand));
  }

  @MessagePattern({ cmd: 'user.create' })
  createUser(@Payload() payload: Record<string, any>) {
    return this.commandBus.execute(CreateUserCommand.create(payload as CreateUserCommand));
  }

  @MessagePattern({ cmd: 'user.update-password' })
  updatePassword(@Payload() payload: { userId: string; hashedPassword: string }) {
    return this.commandBus.execute(UpdatePasswordCommand.create(payload as UpdatePasswordCommand));
  }
}
