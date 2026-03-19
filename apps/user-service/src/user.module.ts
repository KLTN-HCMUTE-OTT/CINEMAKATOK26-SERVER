import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';

import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/core/database/database.module';

import { UserController } from './user.controller';
import { EntityUser } from './entities/user.entity';
import { validateUserEnv } from './config/env.schema';

// Command Handlers
import { CreateUserHandler } from './commands/handlers/create-user.handler';
import { UpdatePasswordHandler } from './commands/handlers/update-password.handler';
import { UpdateUserHandler } from './commands/handlers/update-user.handler';
import { BanUserHandler } from './commands/handlers/ban-user.handler';
import { UnbanUserHandler } from './commands/handlers/unban-user.handler';
import { DeleteUserHandler } from './commands/handlers/delete-user.handler';
import { UpdateProfileHandler } from './commands/handlers/update-profile.handler';
import { ChangePasswordHandler } from './commands/handlers/change-password.handler';
import { UpdateAvatarHandler } from './commands/handlers/update-avatar.handler';
import { DeleteAvatarHandler } from './commands/handlers/delete-avatar.handler';
import { AutoUnbanUsersHandler } from './commands/handlers/auto-unban-users.handler';
import { UserBanSchedulerService } from './services/user-ban-scheduler.service';

// Query Handlers
import { GetUserByEmailHandler } from './queries/handlers/get-user-by-email.handler';
import { GetUserByIdHandler } from './queries/handlers/get-user-by-id.handler';
import { GetUserByProviderIdHandler } from './queries/handlers/get-user-by-providerId.handler';
import { GetAllUsersHandler } from './queries/handlers/get-all-users.handler';

const CommandHandlers = [
  CreateUserHandler,
  UpdateUserHandler,
  UpdatePasswordHandler,
  BanUserHandler,
  UnbanUserHandler,
  DeleteUserHandler,
  UpdateProfileHandler,
  ChangePasswordHandler,
  UpdateAvatarHandler,
  DeleteAvatarHandler,
  AutoUnbanUsersHandler,
];

const QueryHandlers = [
  GetUserByEmailHandler,
  GetUserByIdHandler,
  GetUserByProviderIdHandler,
  GetAllUsersHandler,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/user-service/.env'),
        path.resolve('.env'),
      ],
      validate: validateUserEnv,
      isGlobal: true,
    }),
    CqrsModule,
    ScheduleModule.forRoot(),
    DatabaseModule.forRoot({ service: 'user' }),
    TypeOrmModule.forFeature([EntityUser], 'user'),
    CoreModule,
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [UserController],
  providers: [...CommandHandlers, ...QueryHandlers, UserBanSchedulerService],
})
export class UserServiceModule {}
