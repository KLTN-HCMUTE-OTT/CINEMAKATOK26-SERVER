import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PaymentEntity, PaymentPlan, PaymentStatus, PaymentType } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { DlqEvent } from '../entities/dlq-event.entity';
import { VnpayService } from '../vnpay/vnpay.service';
import { PaymentSaga } from '../saga/payment.saga';
import { RedisService } from './redis.service';
import { PaymentCallbackService } from './payment-callback.service';
import { VnpayCallbackDto } from '../vnpay/dto/vnpay-callback.dto';

/**
 * Retry configuration — exponential backoff with ±25% jitter.
 * Attempt 0 ≈ 1s | Attempt 1 ≈ 2s | Attempt 2 ≈ 4s → then DLQ
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
    RETRY_CONFIG.maxDelay,
  );
  const jitter = delay * 0.25 * (Math.random() * 2 - 1); // ±25%
  return Math.floor(delay + jitter);
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentEntity, 'payment')
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(SagaEventLogEntity, 'payment')
    private readonly sagaLogRepo: Repository<SagaEventLogEntity>,
    @InjectRepository(DlqEvent, 'payment')
    private readonly dlqRepo: Repository<DlqEvent>,
    private readonly vnpayService: VnpayService,
    private readonly paymentSaga: PaymentSaga,
    private readonly redisService: RedisService,
    private readonly paymentCallbackService: PaymentCallbackService,
  ) {}

  /**
   * Initiate a new payment:
   *  1. Create PaymentEntity with PENDING status
   *  2. Initialize saga (writes sagaId + SagaEventLog step 1)
   *  3. Generate VNPAY checkout URL
   *  4. Return { paymentUrl, orderCode }
   */
  async initPayment(payload: {
    userId: string;
    plan: PaymentPlan;
    paymentType?: PaymentType;
    durationDays?: number;
    amount: number;
    ipAddress: string;
    userAgent?: string;
    returnUrl?: string;
    locale?: 'vn' | 'en';
  }) {
    this.logger.log(`Initiating payment for user ${payload.userId}`);

    const orderCode = this.generateOrderCode();
    const durationDays = payload.durationDays ?? 30;

    // Step 1: Persist payment record
    const payment = this.paymentRepo.create({
      userId: payload.userId,
      orderCode,
      amount: payload.amount,
      currency: 'VND',
      plan: payload.plan,
      paymentType: payload.paymentType ?? PaymentType.NEW,
      durationDays,
      status: PaymentStatus.PENDING,
      idempotencyKey: uuidv4(), // Internal dedup key
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      returnUrl: payload.returnUrl ?? process.env.VNPAY_RETURN_URL,
    });

    // save() returns the fully hydrated entity with generated id, createdAt, etc.
    const saved: PaymentEntity = await this.paymentRepo.save(payment);

    // Step 2: Initialize saga (writes sagaId to DB)
    await this.paymentSaga.initializeSaga(saved);

    // Step 3: Build VNPAY checkout URL
    const paymentUrl = this.vnpayService.createPaymentUrl({
      orderCode: saved.orderCode,
      amount: saved.amount,
      orderInfo: `CinemaKatoK - ${saved.plan} subscription`,
      ipAddress: payload.ipAddress,
      returnUrl: saved.returnUrl ?? process.env.VNPAY_RETURN_URL,
      locale: payload.locale ?? 'vn',
    });

    this.logger.log(`Payment ${saved.id} initiated, orderCode=${orderCode}`);

    return {
      success: true,
      data: {
        paymentId: saved.id,
        orderCode: saved.orderCode,
        paymentUrl,
        amount: saved.amount,
        currency: saved.currency,
      },
    };
  }

  /**
   * Handle VNPAY IPN/return-URL callback.
   * Delegates to PaymentCallbackService for the full 7-step processing pipeline.
   */
  async handleCallback(payload: VnpayCallbackDto) {
    const vnpParams = payload as unknown as Record<string, string>;
    return this.paymentCallbackService.handleIpnCallback(vnpParams);
  }

  /**
   * Retrieve paginated payment history for a user.
   */
  async getHistory(userId: string, page = 1, limit = 10) {
    this.logger.log(`Fetching payment history for user ${userId}`);

    const [items, total] = await this.paymentRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((p) => ({
        id: p.id,
        orderCode: p.orderCode,
        plan: p.plan,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentType: p.paymentType,
        bankCode: p.bankCode,
        payDate: p.payDate,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Handle a dead-letter queue message:
   *  1. Log error with context
   *  2. Persist to dlq_event table for manual review
   *  3. Emit on-call alert email (best-effort)
   */
  async handleDeadLetter(payload: {
    event?: string;
    data?: { paymentId?: string };
    error?: string;
    retryCount?: number;
  }) {
    const originalEvent = payload.event ?? 'unknown';
    const retryCount = payload.retryCount ?? 0;

    this.logger.error(`DLQ message received`, {
      originalEvent,
      paymentId: payload.data?.paymentId,
      error: payload.error,
      retryCount,
    });

    // Persist for manual review
    await this.dlqRepo.save(
      this.dlqRepo.create({
        originalEvent,
        payload: payload as Record<string, any>,
        retryCount,
        errorMessage: payload.error,
      }),
    );

    // Alert on-call (fire-and-forget; failure here must not crash the handler)
    try {
      // The notification client is not injected here to keep PaymentService
      // dependency-light — in a real system you'd inject it or use an event bus.
      this.logger.warn(
        `[DLQ] oncall@cinemakatok.com — 🚨 DLQ Alert: ${originalEvent} after ${retryCount} retries. PaymentId: ${payload.data?.paymentId}`,
      );
    } catch (_) {
      // swallow
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Generate a unique order code: CK + yyyyMMddHHmmss + 3-digit seq.
   * e.g. "CK20260514194500001"
   */
  private generateOrderCode(): string {
    const now = new Date();
    const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
    const datePart =
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());
    const seq = Math.floor(Math.random() * 900 + 100); // 100–999
    return `CK${datePart}${seq}`;
  }
}
