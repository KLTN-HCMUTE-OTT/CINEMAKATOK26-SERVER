import { Module } from '@nestjs/common';
import { ExcelModule } from './utils/excel/excel.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [ExcelModule, RedisModule],
  exports: [ExcelModule, RedisModule],
  providers: [],
})
export class CommonModule {
  static forRoot() {
    return {
      module: CommonModule,
      global: true,
    };
  }
}
