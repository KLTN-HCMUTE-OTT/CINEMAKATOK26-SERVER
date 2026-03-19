import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.USER_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.USER_SERVICE_PORT ?? 3002),
        },
      },
    ]),
  ],

  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
