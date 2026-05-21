import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * InitiatePaymentDto
 *
 * Request body for POST /api/v1/payments/subscribe.
 *
 * NOTE: returnUrl is intentionally omitted from this DTO.
 * The VNPAY return URL (vnp_ReturnUrl) must be fixed server-side via the
 * VNPAY_RETURN_URL environment variable and whitelisted in the VNPAY merchant
 * portal. Allowing clients to override it would create an open-redirect
 * vulnerability and would be rejected by VNPAY anyway.
 */
export class InitiatePaymentDto {
  @ApiProperty({
    enum: ['basic', 'premium'],
    description: 'Subscription plan to purchase',
    example: 'premium',
  })
  @IsIn(['basic', 'premium'])
  plan: 'basic' | 'premium';
}
