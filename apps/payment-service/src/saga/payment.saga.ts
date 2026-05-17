import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { randomUUID } from 'crypto';

import { PaymentEntity, PaymentStatus } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { RedisService } from '@app/common';

/**
 * Saga status progression:
 *  STARTED → PAYMENT_COMPLETED → SUBSCRIPTION_ACTIVATED → COMPLETED ✓
 *                              ↘ COMPENSATION_NEEDED → COMPENSATED → FAILED ✗
 */
export enum SagaStatus {
  STARTED = 'started',
  PAYMENT_COMPLETED = 'payment_completed',
  SUBSCRIPTION_ACTIVATED = 'subscription_activated',
  COMPLETED = 'completed',
  COMPENSATION_NEEDED = 'compensation_needed',
  COMPENSATED = 'compensated',
  FAILED = 'failed',
}

/**
 * PaymentSaga orchestrates the distributed subscription-purchase transaction.
 *
 * Steps:
 *  1  CREATE_PAYMENT      — initialised by PaymentService.initPayment
 *  2  PROCESS_VNPAY       — VNPAY handles externally; callback triggers continueAfterPayment
 *  3  ACTIVATE_SUBSCRIPTION — RPC to order-service
 *  4  UPDATE_ENTITLEMENT  — write entitlement to Redis cache
 *  5  SEND_NOTIFICATION   — best-effort RMQ emit
 *  6  OUTBOX_EVENT        — write to outbox table for audit relay
 *
 * Compensation (reverse order when step 3 fails):
 *  4C COMPENSATE_ENTITLEMENT — invalidate Redis cache
 *  3C COMPENSATE_SUBSCRIPTION — RPC cancel to order-service
 */
@Injectable()
export class PaymentSaga {
  private readonly logger = new Logger(PaymentSaga.name);

  constructor(
    @InjectRepository(PaymentEntity, 'payment')
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(SagaEventLogEntity, 'payment')
    private readonly sagaEventLogRepo: Repository<SagaEventLogEntity>,
    @InjectRepository(OutboxEvent, 'payment')
    private readonly outboxRepo: Repository<OutboxEvent>,
    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    private readonly redis: RedisService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Step 1: Initialize a new saga for payment processing.
   * Called once when a payment record is first created.
   *
   * @returns sagaId UUID
   */
  async initializeSaga(payment: PaymentEntity): Promise<string> {
    const sagaId = randomUUID();
    payment.sagaId = sagaId;
    payment.sagaStatus = SagaStatus.STARTED;
    await this.paymentRepo.save(payment);

    await this.logSagaEvent(sagaId, 'CREATE_PAYMENT', 'completed', {
      paymentId: payment.id,
      orderCode: payment.orderCode,
    });

    this.logger.log(`Saga ${sagaId} initialized for payment ${payment.id}`);
    return sagaId;
  }

  /**
   * Steps 3–6: Continue saga after VNPAY payment succeeds.
   * Acquires a distributed lock to prevent concurrent execution for the same saga.
   */
  async continueAfterPayment(payment: PaymentEntity): Promise<void> {
    const sagaId = payment.sagaId;
    if (!sagaId) {
      this.logger.error(`Payment ${payment.id} has no sagaId — cannot continue saga`);
      return;
    }

    // Acquire distributed lock (TTL 30 s) — prevents duplicate execution
    const lockKey = `saga:lock:${sagaId}`;
    const locked = await this.redis.acquireLock(lockKey, 30);
    if (!locked) {
      this.logger.warn(`Saga ${sagaId} already in progress — skipping duplicate`);
      return;
    }

    try {
      // Step 3: Activate Subscription
      await this.logSagaEvent(sagaId, 'ACTIVATE_SUBSCRIPTION', 'started');
      const subscription = await this.activateSubscription(payment);

      if (!subscription) {
        await this.compensatePayment(payment, 'Subscription activation failed');
        return;
      }

      payment.subscriptionId = subscription.id;
      payment.sagaStatus = SagaStatus.SUBSCRIPTION_ACTIVATED;
      await this.paymentRepo.save(payment);
      await this.logSagaEvent(sagaId, 'ACTIVATE_SUBSCRIPTION', 'completed', {
        subscriptionId: subscription.id,
      });

      // Step 4: Update entitlement cache (Redis)
      await this.updateEntitlementCache(payment.userId, subscription);
      await this.logSagaEvent(sagaId, 'UPDATE_ENTITLEMENT', 'completed');

      // Step 5: Send notification — best-effort, never blocks saga completion
      await this.sendPaymentNotification(payment, subscription);
      await this.logSagaEvent(sagaId, 'SEND_NOTIFICATION', 'completed');

      // Step 6: Write outbox event for audit relay
      await this.writeOutboxEvent(payment, subscription);
      await this.logSagaEvent(sagaId, 'OUTBOX_EVENT', 'completed');

      // Mark saga complete
      payment.sagaStatus = SagaStatus.COMPLETED;
      await this.paymentRepo.save(payment);
      await this.logSagaEvent(sagaId, 'SAGA', 'completed');

      this.logger.log(`Saga ${sagaId} completed successfully`);
    } catch (error: any) {
      this.logger.error(`Saga ${sagaId} failed: ${error.message}`, error.stack);
      await this.compensatePayment(payment, error.message);
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  /**
   * Handle payment failure from VNPAY — marks saga as FAILED.
   * No compensation needed since no downstream steps were triggered yet.
   */
  async handlePaymentFailure(
    payment: PaymentEntity,
    responseCode: string,
  ): Promise<void> {
    payment.sagaStatus = SagaStatus.FAILED;
    await this.paymentRepo.save(payment);

    await this.logSagaEvent(payment.sagaId, 'PAYMENT_FAILED', 'completed', {
      responseCode,
    });

    this.logger.warn(
      `Payment ${payment.orderCode} failed with VNPAY code: ${responseCode}`,
    );
  }

  // ─── Compensation ──────────────────────────────────────────────────────────

  /**
   * Compensates completed saga steps in reverse order.
   * Each step is logged independently — failures do not prevent subsequent
   * compensation steps from running.
   */
  async compensatePayment(
    payment: PaymentEntity,
    reason: string,
  ): Promise<void> {
    const sagaId = payment.sagaId;
    this.logger.warn(`Starting compensation for saga ${sagaId}: ${reason}`);

    payment.sagaStatus = SagaStatus.COMPENSATION_NEEDED;
    await this.paymentRepo.save(payment);

    // 4C: Invalidate entitlement cache
    try {
      await this.redis.del(`entitlement:${payment.userId}`);
      await this.logSagaEvent(sagaId, 'COMPENSATE_ENTITLEMENT', 'completed');
    } catch (e: any) {
      this.logger.error(`Entitlement compensation failed: ${e.message}`);
      await this.logSagaEvent(
        sagaId,
        'COMPENSATE_ENTITLEMENT',
        'failed',
        null,
        e.message,
      );
    }

    // 3C: Cancel subscription if it was already created
    if (payment.subscriptionId) {
      try {
        await firstValueFrom(
          this.orderClient
            .send(
              { cmd: 'order.cancelSubscription' },
              { userId: payment.userId },
            )
            .pipe(timeout(5000)),
        );
        await this.logSagaEvent(
          sagaId,
          'COMPENSATE_SUBSCRIPTION',
          'completed',
        );
      } catch (e: any) {
        this.logger.error(`Subscription compensation failed: ${e.message}`);
        await this.logSagaEvent(
          sagaId,
          'COMPENSATE_SUBSCRIPTION',
          'failed',
          null,
          e.message,
        );
      }
    }

    // Mark as compensated and failed for audit trail
    payment.sagaStatus = SagaStatus.COMPENSATED;
    payment.status = PaymentStatus.FAILED;
    await this.paymentRepo.save(payment);

    // Notify admin about inconsistency (best-effort)
    try {
      this.notificationClient.emit('notification.sendEmail', {
        to: 'admin@cinemakatok.com',
        subject: `⚠️ Saga Compensation: ${payment.orderCode}`,
        html: `Payment ${payment.orderCode} required compensation. Reason: ${reason}`,
      });
    } catch (_) {
      // Never block compensation on notification failure
    }

    await this.logSagaEvent(sagaId, 'SAGA', 'compensated', { reason });
    this.logger.warn(`Compensation completed for saga ${sagaId}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Step 3: RPC call to order-service to create/activate a subscription.
   * Timeout: 10 s. Returns null on failure (caller triggers compensation).
   */
  private async activateSubscription(payment: PaymentEntity): Promise<any> {
    try {
      const result = await firstValueFrom(
        this.orderClient
          .send(
            { cmd: 'order.createSubscription' },
            {
              userId: payment.userId,
              plan: payment.plan,
              durationDays: payment.durationDays,
              paymentId: payment.id,
              paymentType: payment.paymentType,
            },
          )
          .pipe(timeout(10000)),
      );
      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to activate subscription for payment ${payment.id}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Step 4: Cache the user's entitlement in Redis.
   * TTL is calculated as the remaining seconds until subscription expiry.
   */
  private async updateEntitlementCache(
    userId: string,
    subscription: any,
  ): Promise<void> {
    const expiresAt = new Date(subscription.expiresAt);
    const ttlSeconds = Math.max(
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      1,
    );

    await this.redis.set(
      `entitlement:${userId}`,
      JSON.stringify({
        plan: subscription.plan?.name ?? subscription.plan,
        expiresAt: subscription.expiresAt,
        isActive: true,
      }),
      ttlSeconds,
    );
  }

  /**
   * Step 5: Emit payment success notification (best-effort).
   * Errors are swallowed — a missed notification does NOT roll back the saga.
   */
  private async sendPaymentNotification(
    payment: PaymentEntity,
    subscription: any,
  ): Promise<void> {
    try {
      this.notificationClient.emit('notification.sendPaymentSuccess', {
        userId: payment.userId,
        orderCode: payment.orderCode,
        plan: payment.plan,
        amount: payment.amount,
        expiresAt: subscription.expiresAt,
      });
    } catch (e: any) {
      this.logger.warn(`Notification emit failed (non-critical): ${e.message}`);
    }
  }

  /**
   * Step 6: Write a transactional outbox event for audit relay.
   * The OutboxRelayService picks this up and publishes it to the audit exchange.
   */
  private async writeOutboxEvent(
    payment: PaymentEntity,
    subscription: any,
  ): Promise<void> {
    const outbox = this.outboxRepo.create({
      aggregateType: 'payment',
      aggregateId: payment.id,
      eventType: 'payment.completed',
      payload: {
        event: 'payment.completed',
        timestamp: new Date().toISOString(),
        data: {
          paymentId: payment.id,
          sagaId: payment.sagaId,
          userId: payment.userId,
          orderCode: payment.orderCode,
          plan: payment.plan,
          amount: payment.amount,
          currency: payment.currency,
          vnpayTxnNo: payment.vnpayTxnNo,
          bankCode: payment.bankCode,
          subscriptionId: subscription.id,
          expiresAt: subscription.expiresAt,
        },
      },
    });
    await this.outboxRepo.save(outbox);
  }

  /**
   * Persist a saga step event to the audit log.
   */
  private async logSagaEvent(
    sagaId: string,
    stepName: string,
    status: string,
    payload?: any,
    error?: string,
  ): Promise<void> {
    const log = this.sagaEventLogRepo.create({
      sagaId,
      stepName,
      status,
      payload: payload ?? undefined,
      error: error ?? undefined,
    });
    await this.sagaEventLogRepo.save(log);
  }
}
