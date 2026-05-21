import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@app/common/base/base-entity';

@Entity({ name: 'saga_event_log' })
export class SagaEventLogEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  sagaId: string;

  @Column({ type: 'varchar', length: 50 })
  stepName: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @Column({ type: 'text', nullable: true })
  error: string;
}
