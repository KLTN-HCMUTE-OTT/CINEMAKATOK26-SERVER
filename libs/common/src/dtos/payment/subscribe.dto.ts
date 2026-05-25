import { IsEnum, IsString, IsDate, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { Expose, Type, Transform } from 'class-transformer';
import { SubscriptionStatus, SubscriptionPlan } from '@app/common/enums/global.enum';

export enum PaymentPlan {
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export class SubscribeDto {
  @ApiProperty({ enum: PaymentPlan, description: 'Subscription plan' })
  @IsEnum(PaymentPlan)
  plan: PaymentPlan;
}

export class InformationSubscribeDto extends BaseEntityDto {
  @ApiProperty({
    description: 'userId',
    example: 'uuid',
  })
  @IsString()
  @Expose()
  userId: string;

  @ApiProperty({
    description: 'planId',
    example: 'uuid',
  })
  @IsString()
  @Expose()
  planId: string;

  @ApiProperty({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsEnum(SubscriptionStatus)
  @Expose()
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'plan name',
    example: 'premium',
  })
  @IsString()
  @Expose()
  @Transform(({ value, obj }) => obj.plan?.name ?? value)
  planName: string;

  @ApiProperty({
    description: 'startsAt',
    example: '2026-05-21T06:49:00.220Z',
  })
  @Type(() => Date)
  @IsDate()
  @Expose()
  startsAt: Date;

  @ApiProperty({
    description: 'expiresAt',
    example: '2026-06-20T06:49:00.220Z',
  })
  @Type(() => Date)
  @IsDate()
  @Expose()
  expiresAt: Date;

  @ApiProperty({
    description: 'autoRenew',
    example: true,
  })
  @IsBoolean()
  @Expose()
  autoRenew: boolean;

  @ApiProperty({
    description: 'paymentId',
    nullable: true,
    example: null,
  })
  @IsOptional()
  @IsString()
  @Expose()
  paymentId?: string | null;
}

export class CheckSubscribeDto {
  @ApiProperty({
    description: 'isActive',
    example: true,
  })
  @IsBoolean()
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'plan',
    example: 'basic',
  })
  @IsString()
  @Expose()
  @IsOptional()
  plan: string;

  @ApiProperty({
    description: 'expiresAt',
    example: '2026-06-20T06:49:00.220Z',
  })
  @Type(() => Date)
  @IsDate()
  @Expose()
  @IsOptional()
  expiresAt: Date;
}

export class CreateSubscriptionDto {
  @ApiProperty({
    enum: SubscriptionPlan,
    default: SubscriptionPlan.BASIC,
  })
  plan: SubscriptionPlan;

  @ApiProperty({
    default: 30,
    description: 'Subscription duration in days',
  })
  @IsNumber()
  durationDays: number;
}