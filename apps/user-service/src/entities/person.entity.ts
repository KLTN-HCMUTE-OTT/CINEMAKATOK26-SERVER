import { Column } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';
import { GENDER } from '@app/common/enums/global.enum';

export class PersonEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: GENDER, nullable: true })
  gender: GENDER;
}
