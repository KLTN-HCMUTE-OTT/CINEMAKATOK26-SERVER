import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

import { EntityContent } from './content.entity';
import { EntityVideo } from './video.entity';

@Entity('movies')
export class EntityMovie extends BaseEntity {
  @Column({ type: 'int' })
  duration: number;

  @OneToOne(() => EntityContent, { cascade: true, eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  metaData: EntityContent;

  // Helper method để lấy videos
  async getVideos(videoRepository): Promise<EntityVideo> {
    return videoRepository.findOne({
      where: {
        ownerType: 'movie',
        ownerId: this.id,
      },
    });
  }
}
