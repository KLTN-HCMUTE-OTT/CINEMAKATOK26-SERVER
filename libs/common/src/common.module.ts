import { Module } from '@nestjs/common';

import { ExcelModule } from './utils/excel/excel.module';

@Module({
  imports: [ExcelModule],
  exports: [ExcelModule],
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
