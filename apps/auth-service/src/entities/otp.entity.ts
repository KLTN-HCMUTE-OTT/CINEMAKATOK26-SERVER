import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { OTP_PURPOSE } from '@app/common/enums/global.enum';

@Entity({
  name: 'user_otp',
})
export class EntityUserOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  otp: string;

  @Column({ type: 'enum', enum: OTP_PURPOSE })
  purpose: OTP_PURPOSE;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  isUsed: boolean;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
