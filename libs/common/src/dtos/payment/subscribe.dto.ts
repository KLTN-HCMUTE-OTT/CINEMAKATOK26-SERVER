import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PaymentPlan {
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export class SubscribeDto {
  @ApiProperty({ enum: PaymentPlan, description: 'Subscription plan' })
  @IsEnum(PaymentPlan)
  plan: PaymentPlan;
}
