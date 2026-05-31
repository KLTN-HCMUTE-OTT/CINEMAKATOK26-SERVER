import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { RESOLUTION, VIDEO_STATUS } from '@app/common/enums/global.enum';
import type { CensorFrame } from '@app/common/types/violence.types';

export enum VideoOwnerType {
  MOVIE = 'movie',
  EPISODE = 'episode',
}
@Entity({ name: 'video' })
export class EntityVideo extends BaseEntity {
  @Column({ type: 'varchar', length: 500, nullable: true })
  videoUrl: string;

  @Column({ type: 'enum', enum: VideoOwnerType, nullable: true })
  ownerType: VideoOwnerType | null;

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ type: 'enum', enum: VIDEO_STATUS, default: VIDEO_STATUS.PROCESSING })
  status: VIDEO_STATUS;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  sprites: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  vttFiles: string[] | null;

  // ─── Violence Detection ────────────────────────────────────────────────────

  @Column({ type: 'boolean', nullable: true, default: null })
  isViolent: boolean | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  violenceScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  violentSegments: CensorFrame[] | null;

  // ─── Nudity Detection ──────────────────────────────────────────────────────

  @Column({ type: 'boolean', nullable: true, default: null })
  isNude: boolean | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  nudityScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  nuditySegments: CensorFrame[] | null;
}

