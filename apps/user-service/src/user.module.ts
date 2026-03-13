import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { EntityUser } from './entities/user.entity';
import { CoreModule } from '@app/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '@app/core/database/database.module';
import { validateUserEnv } from './config/env.schema';
import * as path from 'path';
import { ConfigModule } from '@nestjs/config';

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

    DatabaseModule.forRoot({ service: 'user' }),
    TypeOrmModule.forFeature([EntityUser], 'user'),
    CoreModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserServiceModule {}
