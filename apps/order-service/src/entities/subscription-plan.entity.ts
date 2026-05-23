import { BaseEntity } from '@app/common/base/base-entity';
import { Entity, Column, OneToMany } from 'typeorm';
import { EntitySubscription } from './subscription.entity';

@Entity('subscription_plan')
export class EntitySubscriptionPlan extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'bigint' })
  price: number;

  @Column({ name: 'duration_days', default: 30 })
  durationDays: number;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(
    () => EntitySubscription,
    (subscription) => subscription.plan,
  )
  subscriptions: EntitySubscription[];
}