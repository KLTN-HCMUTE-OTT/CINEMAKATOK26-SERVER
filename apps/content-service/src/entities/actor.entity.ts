import { PersonEntity } from './person.entity';

import { Column, Entity, ManyToMany } from 'typeorm';

import { EntityContent } from './content.entity';

@Entity({ name: 'actor' })
export class EntityActor extends PersonEntity {
  @Column({ type: 'varchar', nullable: true })
  bio?: string;

  @Column({ type: 'varchar', nullable: true })
  profilePicture?: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  nationality?: string;

  @ManyToMany(() => EntityContent, (content) => content.actors)
  contents: EntityContent[];
}

@Entity({ name: 'director' })
export class EntityDirector extends PersonEntity {
  @Column({ type: 'varchar', nullable: true })
  bio?: string;

  @Column({ type: 'varchar', nullable: true })
  profilePicture?: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  nationality?: string;

  @ManyToMany(() => EntityContent, (content) => content.directors)
  contents: EntityContent[];
}
