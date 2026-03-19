import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { RESOLUTION, VIDEO_STATUS } from '@app/common/enums/global.enum';

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
}
