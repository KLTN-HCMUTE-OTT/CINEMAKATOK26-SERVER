import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@app/common/base/base-entity';

export enum DlqEventStatus {
  PENDING_REVIEW = 'pending_review',
  RESOLVED = 'resolved',
  REQUEUED = 'requeued',
}

/**
 * Dead-Letter Queue (DLQ) entity.
 * Persists messages that have exhausted all retry attempts so that
 * they can be manually reviewed and replayed if needed.
 */
@Entity({ name: 'dlq_event' })
export class DlqEvent extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  @Index()
  originalEvent: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({
    type: 'enum',
    enum: DlqEventStatus,
    default: DlqEventStatus.PENDING_REVIEW,
  })
  @Index()
  status: DlqEventStatus;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
