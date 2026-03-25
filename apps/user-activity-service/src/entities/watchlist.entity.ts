import { BaseEntity } from '@app/common/base/base-entity';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity({ name: 'watchlist' })
@Unique(['userId', 'contentId'])
@Index('idx_watchlist_user', ['userId'])
@Index('idx_watchlist_content', ['contentId'])
export class EntityWatchList extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'content_id' })
  contentId: string;
}
