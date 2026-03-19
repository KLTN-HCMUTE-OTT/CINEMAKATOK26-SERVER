import { Column, Entity, ManyToMany } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

import { EntityContent } from './content.entity';

@Entity({
  name: 'tag',
})
export class EntityTag extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  tagName: string;

  @ManyToMany(() => EntityContent, content => content.tags)
  contents: EntityContent[];
}
