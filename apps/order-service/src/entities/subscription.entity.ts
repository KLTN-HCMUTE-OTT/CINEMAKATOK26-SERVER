import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { EntitySubscriptionPlan } from './subscription-plan.entity';

export enum SubscriptionPlan {
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Represents a user's subscription for content access.
 *
 * The DRM license server checks this entity to determine
 * whether a user is entitled to receive decryption keys.
 */
@Entity('subscription')
export class EntitySubscription extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(
    () => EntitySubscriptionPlan,
    (plan) => plan.subscriptions,
  )
  @JoinColumn({ name: 'plan_id' })
  plan: EntitySubscriptionPlan;

  @Column({ type: 'uuid', name: 'plan_id' })
  planId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'auto_renew', default: false })
  autoRenew: boolean;

  @Column({ type: 'varchar', name: 'payment_id', nullable: true })
  paymentId: string | null;
}
