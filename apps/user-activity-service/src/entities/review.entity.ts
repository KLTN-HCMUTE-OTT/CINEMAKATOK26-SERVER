import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';

@Entity({ name: 'review' })
export class EntityReview extends BaseEntity {
  @Column({ type: 'varchar', length: 500 })
  contentReviewed: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'enum', enum: REVIEW_STATUS, default: REVIEW_STATUS.ACTIVE })
  status: REVIEW_STATUS;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'content_id' })
  contentId: string;
}
