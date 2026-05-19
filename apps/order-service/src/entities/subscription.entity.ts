import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

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
@Entity({ name: 'subscription' })
export class EntitySubscription extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.BASIC,
  })
  plan: SubscriptionPlan;

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
}
