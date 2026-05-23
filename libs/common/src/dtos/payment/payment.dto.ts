import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsDate } from 'class-validator';
import { PaymentPlan, PaymentStatus, PaymentType } from '@app/common/enums/global.enum';

// ─── POST /payments/subscribe — Response ────────────────────────────────────

/**
 * Returned after initiating a VNPAY subscription payment.
 * The client should redirect the user to `paymentUrl`.
 */
export class InitiatePaymentResponseDto {
  @ApiProperty({
    description: 'VNPAY checkout URL — redirect the user to this URL to complete payment',
    example: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=...',
  })
  @Expose()
  paymentUrl: string;

  @ApiProperty({
    description: 'Internal order code for tracking this payment',
    example: 'ORD-1716000000000-A3F2',
  })
  @Expose()
  orderCode: string;

  @ApiProperty({
    description: 'Amount to be charged in VND (smallest unit)',
    example: 99000,
  })
  @Expose()
  @IsNumber()
  amount: number;

  @ApiProperty({
    enum: PaymentPlan,
    description: 'Subscription plan being purchased',
    example: PaymentPlan.PREMIUM,
  })
  @Expose()
  @IsEnum(PaymentPlan)
  plan: PaymentPlan;

  @ApiProperty({
    description: 'Idempotency key used to deduplicate this request',
    example: 'abc123def456...',
  })
  @Expose()
  @IsString()
  idempotencyKey: string;
}

// ─── POST /payments/vnpay-ipn — Response ────────────────────────────────────

/**
 * Raw VNPAY acknowledgement.
 * MUST NOT be wrapped by ResponseBuilder — VNPAY checks this exact JSON shape.
 */
export class VnpayIpnResponseDto {
  @ApiProperty({
    description: 'VNPAY result code — "00" means success, everything else is an error',
    example: '00',
  })
  RspCode: string;

  @ApiProperty({
    description: 'Human-readable result message',
    example: 'Confirm Success',
  })
  Message: string;
}

// ─── Shared single-payment shape ─────────────────────────────────────────────

/**
 * Full detail of one payment record.
 * Used by both GET /payments/:id and items inside GET /payments/history.
 */
export class PaymentDetailDto {
  @ApiProperty({
    description: 'Payment UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Owner user UUID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @Expose()
  userId: string;

  @ApiPropertyOptional({
    description: 'Linked subscription UUID (populated after saga completes)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @Expose()
  @IsOptional()
  subscriptionId?: string;

  @ApiProperty({
    description: 'Internal order code sent to VNPAY',
    example: 'ORD-1716000000000-A3F2',
  })
  @Expose()
  orderCode: string;

  @ApiPropertyOptional({
    description: 'VNPAY transaction number (set after payment is confirmed)',
    example: '14262468',
  })
  @Expose()
  @IsOptional()
  vnpayTxnNo?: string;

  @ApiProperty({
    description: 'Charge amount in VND',
    example: 99000,
  })
  @Expose()
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'VND',
  })
  @Expose()
  currency: string;

  @ApiProperty({
    enum: PaymentPlan,
    description: 'Subscription plan',
    example: PaymentPlan.PREMIUM,
  })
  @Expose()
  @IsEnum(PaymentPlan)
  plan: PaymentPlan;

  @ApiProperty({
    enum: PaymentType,
    description: 'Whether this is a new purchase, upgrade, or renewal',
    example: PaymentType.NEW,
  })
  @Expose()
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiProperty({
    description: 'Subscription duration purchased (days)',
    example: 30,
  })
  @Expose()
  @IsNumber()
  durationDays: number;

  @ApiProperty({
    enum: PaymentStatus,
    description: 'Current payment lifecycle status',
    example: PaymentStatus.COMPLETED,
  })
  @Expose()
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'VNPAY response code (e.g. "00" = success)',
    example: '00',
  })
  @Expose()
  @IsOptional()
  vnpayResponseCode?: string;

  @ApiPropertyOptional({
    description: 'VNPAY response message',
    example: 'Giao dich thanh cong',
  })
  @Expose()
  @IsOptional()
  vnpayMessage?: string;

  @ApiPropertyOptional({
    description: 'Bank code used for payment',
    example: 'VIETCOMBANK',
  })
  @Expose()
  @IsOptional()
  bankCode?: string;

  @ApiPropertyOptional({
    description: 'Card type used (ATM or VISA)',
    example: 'ATM',
  })
  @Expose()
  @IsOptional()
  cardType?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when VNPAY confirmed the payment',
    example: '2026-05-21T07:00:00.000Z',
  })
  @Expose()
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  payDate?: Date;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-05-21T06:49:00.220Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({
    description: 'Record last-update timestamp',
    example: '2026-05-21T07:00:00.000Z',
  })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}



