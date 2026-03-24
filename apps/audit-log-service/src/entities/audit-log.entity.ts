// src/audit-log/audit-log.entity.ts
import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';

import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Index()
  @Column()
  userId: string;

  @Index()
  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'enum', enum: LOG_ACTION })
  action: LOG_ACTION;

  @Column({ type: 'enum', enum: RESOURCE_TYPE, nullable: true })
  resourceType: RESOURCE_TYPE;

  @Column({ type: 'uuid', nullable: true })
  resourceId: string;

  @Column({ type: 'smallint' })
  signalWeight: number; // 2=strong, 1=medium, -1=negative, 0=ignored

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
