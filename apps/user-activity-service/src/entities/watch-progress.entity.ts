import { BaseEntity } from '@app/common/base/base-entity';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity({ name: 'watch_progress' })
@Unique(['userId', 'videoId'])
@Index('idx_watch_progress_user_last_watched', ['userId', 'lastWatched'])
export class EntityWatchProgress extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'video_id' })
  videoId: string;

  @Column({ type: 'timestamp', name: 'last_watched', nullable: true })
  lastWatched: Date | null;

  @Column({ type: 'int', name: 'watched_duration', default: 0 })
  watchedDuration: number;

  @Column({ type: 'boolean', name: 'is_completed', default: false })
  isCompleted: boolean;
}
