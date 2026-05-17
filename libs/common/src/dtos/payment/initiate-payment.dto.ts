import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUrl } from 'class-validator';

/**
 * InitiatePaymentDto
 *
 * Request body for POST /api/v1/payments/subscribe.
 * The `plan` field must be exactly 'basic' or 'premium'.
 */
export class InitiatePaymentDto {
  @ApiProperty({
    enum: ['basic', 'premium'],
    description: 'Subscription plan to purchase',
    example: 'premium',
  })
  @IsIn(['basic', 'premium'])
  plan: 'basic' | 'premium';

  @ApiPropertyOptional({
    description:
      'Override the return URL after VNPAY payment. Defaults to VNPAY_RETURN_URL env var.',
    example: 'https://cinemakatok.vn/payment/result',
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}
