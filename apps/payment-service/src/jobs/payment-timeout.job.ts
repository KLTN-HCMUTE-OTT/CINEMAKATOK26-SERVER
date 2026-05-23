import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment.entity';
import { PaymentMetricsService } from '../metrics/payment.metrics';
import { PaymentStatus } from '@app/common/enums/global.enum';

/**
 * PaymentTimeoutJob
 *
 * Cron: every 5 minutes.
 * Bulk-marks PENDING payments older than 15 minutes as EXPIRED.
 * Uses a QueryBuilder bulk UPDATE (not forEach + save) for efficiency.
 */
@Injectable()
export class PaymentTimeoutJob {
  private readonly logger = new Logger(PaymentTimeoutJob.name);

  constructor(
    @InjectRepository(PaymentEntity, 'payment')
    private readonly paymentRepo: Repository<PaymentEntity>,
    private readonly metrics: PaymentMetricsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStalePendingPayments(): Promise<void> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1_000); // 15 minutes ago

    try {
      const result = await this.paymentRepo
        .createQueryBuilder()
        .update(PaymentEntity)
        .set({
          status: PaymentStatus.EXPIRED,
          sagaStatus: 'failed',
          updatedAt: new Date(),
        })
        .where('status = :status', { status: PaymentStatus.PENDING })
        .andWhere('createdAt <= :cutoff', { cutoff })
        .execute();

      if ((result.affected ?? 0) > 0) {
        this.logger.warn(
          `[PaymentTimeoutJob] Expired ${result.affected} stale pending payments`,
          { cutoff: cutoff.toISOString(), affected: result.affected },
        );

        // Emit metric for alerting
        for (let i = 0; i < (result.affected ?? 0); i++) {
          this.metrics.incrementPaymentTimeout();
        }
      } else {
        this.logger.debug('[PaymentTimeoutJob] No stale pending payments found');
      }
    } catch (err: any) {
      this.logger.error(
        `[PaymentTimeoutJob] Failed to expire stale payments: ${err.message}`,
        err.stack,
      );
    }
  }
}
