import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { EntityUser } from './entities/user.entity';
import { CoreModule } from '@app/core';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([EntityUser]),
    CoreModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserServiceModule {}
