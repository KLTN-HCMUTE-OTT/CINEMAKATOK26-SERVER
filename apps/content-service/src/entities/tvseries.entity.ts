import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

import { EntityContent } from './content.entity';
import { EntityVideo } from './video.entity';

@Entity({ name: 'tvseries' })
export class EntityTVSeries extends BaseEntity {
  @OneToOne(() => EntityContent, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'content_id' })
  metaData: EntityContent;

  @OneToMany(() => EntitySeason, (season) => season.tvseries, {
    cascade: true,
    onDelete: 'CASCADE',
    eager: true,
  })
  seasons: EntitySeason[];
}

@Entity({ name: 'season' })
export class EntitySeason extends BaseEntity {
  @Column({ type: 'int' })
  seasonNumber: number;

  @Column({ type: 'int' })
  totalEpisodes: number;

  @OneToMany(() => EntityEpisode, (episode) => episode.season, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  episodes: EntityEpisode[];

  @ManyToOne(() => EntityTVSeries, (tvseries) => tvseries.seasons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tv_series_id' })
  tvseries: EntityTVSeries;
}

@Entity({ name: 'episode' })
export class EntityEpisode extends BaseEntity {
  @Column({ type: 'int' })
  episodeNumber: number;

  @Column({ type: 'int' })
  episodeDuration: number;

  @Column({ type: 'varchar', length: 250 })
  episodeTitle: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  episodeThumbnail: string;

  @ManyToOne(() => EntitySeason, (season) => season.episodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'season_id' })
  season: EntitySeason;

  // @OneToMany(() => EntityReviewEpisode, review => review.episode, {
  //   cascade: true,
  //   onDelete: 'CASCADE',
  // })
  // reviews: EntityReviewEpisode[];
  // Helper method để lấy videos
  async getVideos(videoRepository): Promise<EntityVideo> {
    return videoRepository.findOne({
      where: {
        ownerType: 'episode',
        ownerId: this.id,
      },
    });
  }
}
