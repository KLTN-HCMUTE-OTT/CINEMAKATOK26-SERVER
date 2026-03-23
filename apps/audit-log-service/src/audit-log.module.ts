import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { redisStore } from 'cache-manager-redis-yet';
import * as path from 'path';

import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/core/database/database.module';
import { validateAuditLogEnv } from '../config/env.schema';

import { AuditLogController } from './controller/audit-log.controller';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogService } from './service/audit-log.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/audit-log-service/.env'),
        path.resolve('.env'),
      ],
      validate: validateAuditLogEnv,
      isGlobal: true,
    }),
    CoreModule,
    DatabaseModule.forRoot({ service: 'audit' }),
    TypeOrmModule.forFeature([AuditLog], 'audit'),
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          ttl: 1800000,
        }),
      }),
    }),
    ClientsModule.register([
      {
        name: 'CONTENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.CONTENT_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.CONTENT_SERVICE_PORT ?? 3003),
        },
      },
    ]),
  ],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
