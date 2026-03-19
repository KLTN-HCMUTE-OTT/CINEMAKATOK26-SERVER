import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/core/database/database.module';

import { UserController } from './user.controller';
import { EntityUser } from './entities/user.entity';
import { validateUserEnv } from './config/env.schema';
import { CreateUserHandler } from './commands/handlers/create-user.handler';
import { UpdatePasswordHandler } from './commands/handlers/update-password.handler';
import { UpdateUserHandler } from './commands/handlers/update-user.handler';
import { GetUserByEmailHandler } from './queries/handlers/get-user-by-email.handler';
import { GetUserByIdHandler } from './queries/handlers/get-user-by-id.handler';
import { GetUserByProviderIdHandler } from './queries/handlers/get-user-by-providerId.handler';

const CommandHandlers = [CreateUserHandler, UpdateUserHandler, UpdatePasswordHandler];
const QueryHandlers = [GetUserByEmailHandler, GetUserByIdHandler, GetUserByProviderIdHandler];

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
    DatabaseModule.forRoot({ service: 'user' }),
    TypeOrmModule.forFeature([EntityUser], 'user'),
    CoreModule,
  ],
  controllers: [UserController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class UserServiceModule {}
