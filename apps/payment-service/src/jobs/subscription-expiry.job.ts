import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentMetricsService } from '../metrics/payment.metrics';
import { RedisCacheService } from '../services/redis-cache.service';

// We use a lightweight inline interface so we don't create a cross-service
// entity dependency. In production the subscription entity lives in order-service.
interface SubscriptionRecord {
  id: string;
  userId: string;
  status: string;
  expiresAt: Date;
  plan: string | { name: string };
  notifiedExpiry: boolean;
}

/**
 * SubscriptionExpiryJob
 *
 * Runs daily at 08:00 Vietnam time (01:00 UTC).
 *
 * 1. Finds subscriptions expiring in the next 3 days → emits `subscription.expiring`
 * 2. Marks past-due `active` subscriptions as `expired` (bulk UPDATE)
 * 3. Invalidates the Redis entitlement cache for every newly-expired user
 */
@Injectable()
export class SubscriptionExpiryJob {
  private readonly logger = new Logger(SubscriptionExpiryJob.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientProxy,
    private readonly redis: RedisCacheService,
    private readonly metrics: PaymentMetricsService,
  ) {}

  // 01:00 UTC = 08:00 Vietnam (UTC+7)
  @Cron('0 1 * * *')
  async processExpiringSubscriptions(): Promise<void> {
    this.logger.log('[SubscriptionExpiryJob] Starting daily subscription expiry check');

    try {
      await this.notifyExpiringSubscriptions();
      await this.expireOverdueSubscriptions();
    } catch (err: any) {
      this.logger.error(
        `[SubscriptionExpiryJob] Unexpected error: ${err.message}`,
        err.stack,
      );
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Ask the order-service for subscriptions expiring within 3 days
   * and emit a `subscription.expiring` event for each one.
   */
  private async notifyExpiringSubscriptions(): Promise<void> {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1_000);

    let subscriptions: SubscriptionRecord[] = [];
    try {
      const { firstValueFrom, timeout } = await import('rxjs');
      subscriptions = await firstValueFrom(
        this.orderClient
          .send(
            { cmd: 'order.getExpiringSoon' },
            { before: threeDaysFromNow.toISOString() },
          )
          .pipe(timeout(10_000)),
      );
    } catch (err: any) {
      this.logger.error(
        `[SubscriptionExpiryJob] Could not fetch expiring subscriptions: ${err.message}`,
      );
      return;
    }

    this.logger.log(
      `[SubscriptionExpiryJob] Found ${subscriptions.length} subscriptions expiring in ≤3 days`,
    );

    for (const sub of subscriptions) {
      const daysRemaining = Math.ceil(
        (new Date(sub.expiresAt).getTime() - Date.now()) / (24 * 3_600 * 1_000),
      );
      const planName =
        typeof sub.plan === 'string' ? sub.plan : (sub.plan as any)?.name;

      this.notificationClient.emit('subscription.expiring', {
        event: 'subscription.expiring',
        timestamp: new Date().toISOString(),
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          plan: planName,
          expiresAt: new Date(sub.expiresAt).toISOString(),
          daysRemaining,
        },
      });
    }
  }

  /**
   * Ask the order-service to bulk-expire past-due subscriptions,
   * then invalidate the Redis entitlement cache for each affected user.
   */
  private async expireOverdueSubscriptions(): Promise<void> {
    let expiredUsers: string[] = [];
    try {
      const { firstValueFrom, timeout } = await import('rxjs');
      expiredUsers = await firstValueFrom(
        this.orderClient
          .send({ cmd: 'order.expireOverdue' }, {})
          .pipe(timeout(15_000)),
      );
    } catch (err: any) {
      this.logger.warn(
        `[SubscriptionExpiryJob] Could not expire overdue subscriptions: ${err.message}`,
      );
      return;
    }

    this.logger.log(
      `[SubscriptionExpiryJob] Expired ${expiredUsers.length} overdue subscriptions`,
    );

    // Invalidate entitlement cache for every affected user so streaming-service
    // re-checks on the next request (fail-closed).
    await Promise.allSettled(
      expiredUsers.map((userId) =>
        this.redis.invalidateEntitlement(userId).catch((e) =>
          this.logger.warn(
            `[SubscriptionExpiryJob] Cache invalidation failed for user ${userId}: ${e.message}`,
          ),
        ),
      ),
    );
  }
}
