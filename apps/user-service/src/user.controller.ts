import { Controller } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateUserCommand } from './commands/impl/create-user.command';
import { UpdatePasswordCommand } from './commands/impl/update-password.command';
import { UpdateUserCommand } from './commands/impl/update-user.command';
import { GetUserByEmailQuery } from './queries/impl/get-user-by-email.query';
import { GetUserByIdQuery } from './queries/impl/get-user-by-id.query';
import { GetUserByProviderIdQuery } from './queries/impl/get-user-by-providerId.query';
import { UpdateProfileRequest } from '@app/common/dtos/user/profile.dto';
import { PaginationQueryDto } from '@app/common/utils/dto';

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
  updateProfile(@Payload() payload: { userId: string; updateProfileRequest: UpdateProfileRequest }) {
    return this.commandBus.execute(UpdateUserCommand.create(payload as UpdateUserCommand));
  }

  @MessagePattern({ cmd: 'user.create' })
  createUser(@Payload() payload: CreateUserCommand) {
    return this.commandBus.execute(CreateUserCommand.create(payload));
  }

  @MessagePattern({ cmd: 'user.update-password' })
  updatePassword(@Payload() payload: { userId: string; hashedPassword: string }) {
    return this.commandBus.execute(UpdatePasswordCommand.create(payload as UpdatePasswordCommand));
  }

  @MessagePattern({ cmd: 'user.find-by-providerId' })
  findByProviderId(@Payload() payload: { providerId: string }) {
    return this.queryBus.execute(new GetUserByProviderIdQuery(payload.providerId));
  }

  @MessagePattern({ cmd: 'user.getUserDetail' })
  getUserDetail(@Payload() payload: { userId: string }) {
    return this.queryBus.execute(new GetUserByIdQuery(payload.userId));
  }

  // @MessagePattern({ cmd: 'user.getAllUsers' })
  // getAllUsers(@Payload() payload: { query: PaginationQueryDto, search?: string }) {
  //   return this.queryBus.execute(new GetAllUsersQuery(payload.query, payload.search));
  // }

  // @MessagePattern({ cmd: 'user.banUser' })
  // banUser(@Payload() payload: { userId: string; banUserRequest: BanUserRequest }) {
  //   return this.commandBus.execute(BanUserCommand.create(payload as BanUserCommand));
  // }

  // @MessagePattern({ cmd: 'user.unbanUser' })
  // unbanUser(@Payload() payload: { userId: string; unbanUserRequest: UnbanUserRequest }) {
  //   return this.commandBus.execute(UnbanUserCommand.create(payload as UnbanUserCommand));
  // }

  // @MessagePattern({ cmd: 'user.deleteUser' })
  // deleteUser(@Payload() payload: { userId: string }) {
  //   return this.commandBus.execute(DeleteUserCommand.create(payload as DeleteUserCommand));
  // }

  // @MessagePattern({ cmd: 'user.updateUser' })
  // updateUser(@Payload() payload: { userId: string; updateUserRequest: UpdateUserRequest }) {
  //   return this.commandBus.execute(UpdateUserCommand.create(payload as UpdateUserCommand));
  // }

  // @MessagePattern({ cmd: 'user.updateUser' })
  // updateUser(@Payload() payload: { userId: string; updateUserRequest: UpdateUserRequest }) {
  //   return this.commandBus.execute(UpdateUserCommand.create(payload as UpdateUserCommand));
  // }
}
