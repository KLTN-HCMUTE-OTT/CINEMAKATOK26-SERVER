import { Controller } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MessagePattern, Payload } from '@nestjs/microservices';

// Commands
import { CreateUserCommand } from './commands/impl/create-user.command';
import { UpdatePasswordCommand } from './commands/impl/update-password.command';
import { UpdateUserCommand } from './commands/impl/update-user.command';
import { BanUserCommand } from './commands/impl/ban-user.command';
import { UnbanUserCommand } from './commands/impl/unban-user.command';
import { DeleteUserCommand } from './commands/impl/delete-user.command';
import { UpdateProfileCommand } from './commands/impl/update-profile.command';
import { ChangePasswordCommand } from './commands/impl/change-password.command';
import { UpdateAvatarCommand } from './commands/impl/update-avatar.command';
import { DeleteAvatarCommand } from './commands/impl/delete-avatar.command';

// Queries
import { GetUserByEmailQuery } from './queries/impl/get-user-by-email.query';
import { GetUserByIdQuery } from './queries/impl/get-user-by-id.query';
import { GetUserByProviderIdQuery } from './queries/impl/get-user-by-providerId.query';
import { GetAllUsersQuery } from './queries/impl/get-all-users.query';

// DTOs
import { UpdateProfileRequest, UpdateAvatarRequest } from '@app/common/dtos/user/profile.dto';
import { ChangePasswordRequest } from '@app/common/dtos/user/profile.dto';
import { PaginationQueryDto } from '@app/common/utils/dto';
import { BanUserDto, UpdateUserDto } from '@app/common/dtos/user/user.dto';

@Controller()
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ─── Queries ─────────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'user.find-by-email' })
  findByEmail(@Payload() payload: { email: string }) {
    return this.queryBus.execute(new GetUserByEmailQuery(payload.email));
  }

  @MessagePattern({ cmd: 'user.find-by-providerId' })
  findByProviderId(@Payload() payload: { providerId: string }) {
    return this.queryBus.execute(new GetUserByProviderIdQuery(payload.providerId));
  }

  @MessagePattern({ cmd: 'user.getProfile' })
  getProfile(@Payload() payload: { userId: string }) {
    return this.queryBus.execute(new GetUserByIdQuery(payload.userId));
  }

  @MessagePattern({ cmd: 'user.getById' })
  getById(@Payload() payload: { id: string }) {
    return this.queryBus.execute(new GetUserByIdQuery(payload.id));
  }

  @MessagePattern({ cmd: 'user.getUserDetail' })
  getUserDetail(@Payload() payload: { userId: string }) {
    return this.queryBus.execute(new GetUserByIdQuery(payload.userId));
  }

  @MessagePattern({ cmd: 'user.getAllUsers' })
  getAllUsers(@Payload() payload: { query: PaginationQueryDto; search?: string }) {
    return this.queryBus.execute(new GetAllUsersQuery(payload.query, payload.search));
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'user.createUser' })
  createUser(@Payload() payload: CreateUserCommand) {
    return this.commandBus.execute(CreateUserCommand.create(payload));
  }

  @MessagePattern({ cmd: 'user.updateUser' })
  updateUser(@Payload() payload: { userId: string; updateUserRequest: UpdateUserDto }) {
    return this.commandBus.execute(
      UpdateUserCommand.create({
        userId: payload.userId,
        ...payload.updateUserRequest,
      } as UpdateUserCommand),
    );
  }

  @MessagePattern({ cmd: 'user.updateProfile' })
  updateProfile(@Payload() payload: { userId: string; updateDto: UpdateProfileRequest }) {
    return this.commandBus.execute(
      UpdateProfileCommand.create(payload as UpdateProfileCommand),
    );
  }

  @MessagePattern({ cmd: 'user.changePassword' })
  changePassword(
    @Payload() payload: { userId: string; changePasswordDto: ChangePasswordRequest },
  ) {
    return this.commandBus.execute(
      ChangePasswordCommand.create(payload as ChangePasswordCommand),
    );
  }

  @MessagePattern({ cmd: 'user.updateAvatar' })
  updateAvatar(@Payload() payload: { userId: string; updateAvatarDto: UpdateAvatarRequest }) {
    return this.commandBus.execute(
      UpdateAvatarCommand.create({
        userId: payload.userId,
        avatarUrl: payload.updateAvatarDto.avatarUrl,
      } as UpdateAvatarCommand),
    );
  }

  @MessagePattern({ cmd: 'user.deleteAvatar' })
  deleteAvatar(@Payload() payload: { userId: string }) {
    return this.commandBus.execute(
      DeleteAvatarCommand.create(payload as DeleteAvatarCommand),
    );
  }

  @MessagePattern({ cmd: 'user.update-password' })
  updatePassword(@Payload() payload: { userId: string; hashedPassword: string }) {
    return this.commandBus.execute(UpdatePasswordCommand.create(payload as UpdatePasswordCommand));
  }

  @MessagePattern({ cmd: 'user.banUser' })
  banUser(@Payload() payload: { userId: string; banUserRequest: BanUserDto }) {
    return this.commandBus.execute(
      BanUserCommand.create({
        userId: payload.userId,
        ...payload.banUserRequest,
      } as BanUserCommand),
    );
  }

  @MessagePattern({ cmd: 'user.unbanUser' })
  unbanUser(@Payload() payload: { userId: string }) {
    return this.commandBus.execute(UnbanUserCommand.create(payload as UnbanUserCommand));
  }

  @MessagePattern({ cmd: 'user.deleteUser' })
  deleteUser(@Payload() payload: { userId: string }) {
    return this.commandBus.execute(DeleteUserCommand.create(payload as DeleteUserCommand));
  }
}
