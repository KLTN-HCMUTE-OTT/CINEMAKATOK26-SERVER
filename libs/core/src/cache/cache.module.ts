import { getConfig } from '@app/common/utils/get-config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    NestCacheModule.register({
      store: 'memory',
      max: getConfig('core.cache.max', 100),
      ttl: getConfig('core.cache.ttl', 60),
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
