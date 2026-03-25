import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { REVIEW_STATUS } from '@app/common/enums/global.enum';

import { EntityReviewEpisode } from './review-episode.entity';
import { EntityReview } from './review.entity';

@Entity({ name: 'review_reply' })
export class EntityReviewReply extends BaseEntity {
  @Column({ type: 'varchar', length: 500 })
  content: string;

  @Column({ type: 'enum', enum: REVIEW_STATUS, default: REVIEW_STATUS.ACTIVE })
  status: REVIEW_STATUS;

  @ManyToOne(() => EntityReview, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'review_id' })
  review: EntityReview | null;

  @ManyToOne(() => EntityReviewEpisode, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'episode_review_id' })
  episodeReview: EntityReviewEpisode | null;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  // Self-referencing for nested replies
  @ManyToOne(() => EntityReviewReply, reply => reply.childReplies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_reply_id' })
  parentReply: EntityReviewReply | null;

  @OneToMany(() => EntityReviewReply, reply => reply.parentReply)
  childReplies: EntityReviewReply[];
}
