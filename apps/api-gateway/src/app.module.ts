import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ContentModule } from './content/content.module';
import { UserActivityModule } from './user-activity/user-activity.module';
import { PaymentModule } from './payment/payment.module';
import { StreamingModule } from './streaming/streaming.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    UserModule,
    ContentModule,
    UserActivityModule,
    PaymentModule,
    StreamingModule,
    AuditLogModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
