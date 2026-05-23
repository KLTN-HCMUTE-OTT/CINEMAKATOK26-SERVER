import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { EntitySubscriptionPlan } from './subscription-plan.entity';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '@app/common/enums/global.enum';
/**
 * Represents a user's subscription for content access.
 *
 * The DRM license server checks this entity to determine
 * whether a user is entitled to receive decryption keys.
 */
@Entity('subscription')
export class EntitySubscription extends BaseEntity {
  @ApiProperty()
  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(
    () => EntitySubscriptionPlan,
    (plan) => plan.subscriptions,
  )
  @JoinColumn({ name: 'plan_id' })
  plan: EntitySubscriptionPlan;

  @ApiProperty()
  @Column({ type: 'uuid', name: 'plan_id' })
  planId: string;

  @ApiProperty({ enum: SubscriptionStatus })
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @ApiProperty()
  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @ApiProperty()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @ApiProperty()
  @Column({ name: 'auto_renew', default: false })
  autoRenew: boolean;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', name: 'payment_id', nullable: true })
  paymentId: string | null;
}
