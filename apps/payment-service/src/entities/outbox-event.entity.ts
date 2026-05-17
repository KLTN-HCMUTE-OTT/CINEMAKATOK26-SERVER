import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@app/common/base/base-entity';

/**
 * Outbox pattern entity for reliable event publishing.
 * Events are written transactionally with business logic, then
 * relayed to the message broker by OutboxRelayService (polling publisher).
 */
@Entity({ name: 'outbox_event' })
export class OutboxEvent extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  @Index()
  aggregateType: string;

  @Column({ type: 'uuid' })
  @Index()
  aggregateId: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  @Index()
  published: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
