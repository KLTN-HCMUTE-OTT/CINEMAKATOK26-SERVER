import { BaseEntity } from '@app/common/base/base-entity';
import { Column, Entity, Index, Unique } from 'typeorm';

@Entity({ name: 'favorite' })
@Unique(['userId', 'contentId'])
@Index('idx_favorite_user', ['userId'])
@Index('idx_favorite_content', ['contentId'])
export class EntityFavorite extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'content_id' })
  contentId: string;
}
