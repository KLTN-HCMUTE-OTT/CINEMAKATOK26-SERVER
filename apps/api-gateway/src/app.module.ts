import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ContentModule } from './content/content.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { StreamingModule } from './streaming/streaming.module';
import { NotificationModule } from './notification/notification.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    UserModule,
    ContentModule,
    OrderModule,
    PaymentModule,
    StreamingModule,
    NotificationModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
