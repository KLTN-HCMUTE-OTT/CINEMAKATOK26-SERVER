import { Column, Entity, Unique } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';

@Unique(['userId', 'episodeId'])
@Entity({ name: 'review_episode' })
export class EntityReviewEpisode extends BaseEntity {
  @Column({ type: 'varchar', length: 500 })
  contentReviewed: string;

  @Column({ type: 'enum', enum: REVIEW_STATUS, default: REVIEW_STATUS.ACTIVE })
  status: REVIEW_STATUS;

  @Column({ type: 'uuid', name: 'episode_id' })
  episodeId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;
}
