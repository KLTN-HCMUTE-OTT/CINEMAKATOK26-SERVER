import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';

import { WATCH_PARTY_CLIENT } from '@app/common/dtos/watch-party';

import { AuditLogModule } from '../audit-log/audit-log.module';
import { UserModule } from '../user/user.module';
import { WatchPartyService } from './watch-party.service';
import { WatchPartyController } from './watch-party.controller';
import { WatchPartyGateway } from './watch-party.gateway';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    AuditLogModule,
    UserModule,
    ClientsModule.registerAsync([
      {
        name: WATCH_PARTY_CLIENT,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('WATCH_PARTY_SERVICE_HOST', 'localhost'),
            port: Number(config.get<number>('WATCH_PARTY_SERVICE_PORT', 3009)),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [WatchPartyController],
  providers: [WatchPartyGateway, WatchPartyService, WsJwtGuard],
})
export class WatchPartyModule {}
