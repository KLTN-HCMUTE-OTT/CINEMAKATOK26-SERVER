import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import { EntityRefreshToken } from './entities/refresh-token.entity';
import { EntityUserOtp } from './entities/otp.entity';
import { PassportModule } from '@nestjs/passport';
// import { ScheduleModule } from '@nestjs/schedule';
import {CoreModule} from '@app/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { getConfig } from '@app/common/utils/get-config';
// import { googleOauthConfig } from './config/google-oauth.config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TokenService } from './services/token.service';
import { OtpService } from './services/otp.service';
import { EmailService } from './services/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EntityRefreshToken, EntityUserOtp]),
    PassportModule,
    // ScheduleModule.forRoot(),
    CoreModule, // For AxiosService
    JwtModule.register({
      privateKey: getConfig('jwt.privateKey', 'your_jwt_private_key'),
      publicKey: getConfig('jwt.publicKey', 'your_jwt_public_key'),
      signOptions: {
        expiresIn: getConfig('jwt.expiresTime', '5m'),
        algorithm: 'RS256',
      },
    }),
    // ConfigModule.forFeature(googleOauthConfig),
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.USER_SERVICE_HOST,
          port: Number(process.env.USER_SERVICE_PORT),
        },
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService,OtpService, EmailService ],
})
export class AuthServiceModule {}
