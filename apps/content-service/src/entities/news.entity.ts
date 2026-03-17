//import { EntityUser } from 'src/auth/entities/user.entity';

import { Column, Entity, ManyToMany, ManyToOne, OneToOne } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

@Entity({
  name: 'news',
})
export class EntityNews extends BaseEntity {
  @Column({ type: 'text' })
  title: string;
  @Column({ type: 'text' })
  summary: string;
  @Column({ type: 'text' })
  content_html: string;
  @Column({ type: 'varchar', length: 500 })
  cover_image: string;

  @Column({ type: 'text', array: true, default: [] })
  category: string[];

  //   @ManyToOne(() => EntityUser, (user) => user.news)
  //   author: EntityUser;
}
