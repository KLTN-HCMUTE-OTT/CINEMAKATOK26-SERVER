import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { SocialAuthService } from './services/social-auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityRefreshToken } from './entities/refresh-token.entity';
import { EntityUserOtp } from './entities/otp.entity';
import { PassportModule } from '@nestjs/passport';
import { CoreModule } from '@app/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TokenService } from './services/token.service';
import { OtpService } from './services/otp.service';
import { DatabaseModule } from '@app/core/database/database.module';
import { validateAuthEnv } from './config/env.schema';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/auth-service/.env'),
        path.resolve('.env'),
      ],
      validate: validateAuthEnv,
      isGlobal: true,
    }),

    DatabaseModule.forRoot({ service: 'auth' }),
    TypeOrmModule.forFeature([EntityRefreshToken, EntityUserOtp], 'auth'),

    PassportModule,
    CoreModule,

    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        privateKey: config.get<string>('JWT_PRIVATE_KEY'),
        publicKey: config.get<string>('JWT_PUBLIC_KEY'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_TIME', '5m') as any,
          algorithm: 'RS256',
        },
      }),
      inject: [ConfigService],
    }),

    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('USER_SERVICE_HOST', 'localhost'),
            port: config.get<number>('USER_SERVICE_PORT', 3002),
          },
        }),
        inject: [ConfigService],
      },
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
  controllers: [AuthController],
  providers: [AuthService, TokenService, OtpService, SocialAuthService],
})
export class AuthServiceModule {}