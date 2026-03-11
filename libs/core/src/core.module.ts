import { Module } from '@nestjs/common';

import { AxiosModule } from './axios/axios.module';
import { CacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule, CacheModule, AxiosModule.forRoot()],
  exports: [DatabaseModule, CacheModule],
})
export class CoreModule {
  static forRoot() {
    return {
      module: CoreModule,
      global: true,
    };
  }
}
