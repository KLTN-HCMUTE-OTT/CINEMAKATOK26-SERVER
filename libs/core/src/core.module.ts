import { Module } from '@nestjs/common';

import { AxiosModule } from './axios/axios.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [CacheModule, AxiosModule.forRoot()],
  exports: [CacheModule],
})
export class CoreModule {
  static forRoot() {
    return {
      module: CoreModule,
      global: true,
    };
  }
}
