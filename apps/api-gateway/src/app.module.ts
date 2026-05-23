import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '@app/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ContentModule } from './content/content.module';
import { UserActivityModule } from './user-activity/user-activity.module';
import { PaymentModule } from './payment/payment.module';
import { StreamingModule } from './streaming/streaming.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WatchPartyModule } from './watch-party/watch-party.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    AuthModule,
    UserModule,
    ContentModule,
    UserActivityModule,
    PaymentModule,
    StreamingModule,
    AuditLogModule,
    AnalyticsModule,
    WatchPartyModule,
  ],
})
export class AppModule {}
