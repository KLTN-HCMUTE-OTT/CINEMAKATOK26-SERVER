import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { MaturityRating } from '@app/common/enums/global.enum';

import { EntityActor, EntityDirector } from './actor.entity';
import { EntityCategory } from './category.entity';
import { EntityTag } from './tag.entity';

export enum ContentType {
  MOVIE = 'MOVIE',
  TVSERIES = 'TVSERIES',
}
@Entity({
  name: 'content',
})
export class EntityContent extends BaseEntity {
  @Column({ type: 'enum', enum: ContentType })
  type: ContentType;
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  releaseDate: Date;

  @Column({ type: 'varchar', length: 250 })
  thumbnail: string;

  @Column({ type: 'varchar', length: 250 })
  banner?: string;

  @Column({ type: 'varchar', length: 250 })
  trailer: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  avgRating: number;

  @Column({ type: 'enum', enum: MaturityRating, default: MaturityRating.G })
  maturityRating: MaturityRating;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  imdbRating: number;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @ManyToMany(() => EntityCategory, (category) => category.contents)
  @JoinTable({
    name: 'content_category',
    joinColumn: { name: 'content_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: EntityCategory[];

  @ManyToMany(() => EntityActor, (actor) => actor.contents)
  @JoinTable({
    name: 'content_actor',
    joinColumn: { name: 'content_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'actor_id', referencedColumnName: 'id' },
  })
  actors: EntityActor[];

  @ManyToMany(() => EntityDirector, (director) => director.contents)
  @JoinTable({
    name: 'content_director',
    joinColumn: { name: 'content_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'director_id', referencedColumnName: 'id' },
  })
  directors: EntityDirector[];

  @ManyToMany(() => EntityTag, (tag) => tag.contents)
  @JoinTable({
    name: 'content_tag',
    joinColumn: { name: 'content_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: EntityTag[];

  // @OneToMany(() => EntityReview, review => review.content)
  // reviews: EntityReview[];
}
