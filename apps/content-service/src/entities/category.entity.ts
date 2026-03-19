import { Column, Entity, ManyToMany } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

import { EntityContent } from './content.entity';

@Entity({
  name: 'category',
})
export class EntityCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  categoryName: string;

  @ManyToMany(() => EntityContent, content => content.categories)
  contents: EntityContent[];
}
