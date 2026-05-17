import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment.entity';

export interface StuckSagaDto {
  sagaId: string;
  sagaStatus: string;
  orderCode: string;
  createdAt: Date;
  ageSeconds: number;
}

export interface CompensationAuditDto {
  orderCode: string;
  sagaStatus: string;
  amount: number;
  stepName: string;
  stepStatus: string;
  error: string | null;
  stepCreatedAt: Date;
}

/**
 * SagaMonitorService
 *
 * Internal admin-only queries:
 *  1. findStuckSagas   — sagas in a non-terminal state for > 30 minutes
 *  2. getCompensationAudit — full event trail for compensated sagas
 */
@Injectable()
export class SagaMonitorService {
  private readonly logger = new Logger(SagaMonitorService.name);

  constructor(
    @InjectRepository(PaymentEntity, 'payment')
    private readonly paymentRepo: Repository<PaymentEntity>,
  ) {}

  /**
   * Returns payments whose saga has been stuck in a non-terminal state
   * for more than 30 minutes.
   */
  async findStuckSagas(): Promise<StuckSagaDto[]> {
    const results = await this.paymentRepo
      .createQueryBuilder('p')
      .select([
        'p.saga_id          AS "sagaId"',
        'p.saga_status      AS "sagaStatus"',
        'p.order_code       AS "orderCode"',
        'p.created_at       AS "createdAt"',
        `EXTRACT(EPOCH FROM (NOW() - p.created_at)) AS "ageSeconds"`,
      ])
      .where('p.sagaStatus NOT IN (:...terminal)', {
        terminal: ['completed', 'failed', 'compensated'],
      })
      .andWhere(`p.createdAt < NOW() - INTERVAL '30 minutes'`)
      .orderBy('p.createdAt', 'ASC')
      .getRawMany();

    if (results.length > 0) {
      this.logger.warn(
        `[SagaMonitor] Found ${results.length} stuck sagas older than 30 minutes`,
      );
    }

    return results as StuckSagaDto[];
  }

  /**
   * Returns the compensation audit trail: each saga step event for all
   * sagas that required compensation, ordered by payment date desc, step asc.
   */
  async getCompensationAudit(limit = 50): Promise<CompensationAuditDto[]> {
    const results = await this.paymentRepo
      .createQueryBuilder('p')
      .leftJoin('saga_event_log', 'sel', 'sel.sagaId = p.sagaId')
      .select([
        'p.order_code    AS "orderCode"',
        'p.saga_status   AS "sagaStatus"',
        'p.amount        AS "amount"',
        'sel.step_name   AS "stepName"',
        'sel.status      AS "stepStatus"',
        'sel.error       AS "error"',
        'sel.created_at  AS "stepCreatedAt"',
      ])
      .where('p.sagaStatus = :status', { status: 'compensated' })
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('sel.createdAt', 'ASC')
      .limit(limit)
      .getRawMany();

    return results as CompensationAuditDto[];
  }
}
