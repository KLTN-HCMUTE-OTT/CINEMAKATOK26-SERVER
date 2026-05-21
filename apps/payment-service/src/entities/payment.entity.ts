import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@app/common/base/base-entity';
import { PaymentPlan, PaymentStatus, PaymentType } from '@app/common/enums/global.enum';

@Entity({ name: 'payment' })
export class PaymentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  orderCode: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vnpayTxnNo: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentPlan })
  plan: PaymentPlan;

  @Column({ type: 'enum', enum: PaymentType })
  paymentType: PaymentType;

  @Column({ type: 'int', default: 30 })
  durationDays: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 10, nullable: true })
  vnpayResponseCode: string;

  @Column({ type: 'text', nullable: true })
  vnpayMessage: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cardType: string;

  @Column({ type: 'timestamptz', nullable: true })
  payDate: Date;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  sagaId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sagaStatus: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'text', nullable: true })
  returnUrl: string;
}
