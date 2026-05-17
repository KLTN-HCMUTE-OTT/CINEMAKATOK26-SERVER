import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import * as path from 'path';
import Redis from 'ioredis';

import { WatchPartyController } from './controller/watch-party.controller';
import { WatchPartyService } from './service/watch-party.service';
import { WATCH_PARTY_REDIS } from './watch-party.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve('apps/watch-party-service/.env'),
        path.resolve('.env'),
      ],
    }),
  ],
  controllers: [WatchPartyController],
  providers: [
    WatchPartyService,
    {
      provide: WATCH_PARTY_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('WatchPartyRedis');
        const client = new Redis({
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(config.get<number>('REDIS_PORT') ?? 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          lazyConnect: false,
          maxRetriesPerRequest: 2,
        });
        client.on('error', (err) =>
          logger.error(`Redis error: ${err.message}`),
        );
        return client;
      },
    },
  ],
})
export class WatchPartyServiceModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown() {
    const redis = this.moduleRef.get<Redis>(WATCH_PARTY_REDIS, {
      strict: false,
    });
    if (redis && typeof redis.quit === 'function') {
      await redis.quit().catch(() => undefined);
    }
  }
}
