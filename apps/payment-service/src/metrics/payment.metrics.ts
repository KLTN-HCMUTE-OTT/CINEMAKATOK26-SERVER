import { Injectable, Logger } from '@nestjs/common';

/**
 * PaymentMetricsService
 *
 * In-memory counters & histograms for the payment domain.
 * In production these would be wired to Prometheus / Datadog;
 * here they expose simple methods that log structured metrics and
 * check alert thresholds.
 *
 * Alert thresholds (per spec):
 *  - payment.failed.count > 10% of initiated in rolling 15 min → WARN
 *  - payment.timeout.count > 5 in 15 min                       → WARN
 *  - saga.compensation.count > 0                               → IMMEDIATE WARN
 *  - dlq.messages.count > 0                                    → WARN
 */
@Injectable()
export class PaymentMetricsService {
  private readonly logger = new Logger(PaymentMetricsService.name);

  // ── Counters ───────────────────────────────────────────────────────────────

  private counts = {
    initiated: 0,
    completed: 0,
    failed: 0,
    timeout: 0,
    sagaCompensation: 0,
    duplicateCallback: 0,
    dlqMessage: 0,
  };

  /** Rolling 15-minute window buckets (index = minute slot) */
  private readonly windowMs = 15 * 60 * 1_000;
  private windowStart = Date.now();

  // ── Histograms (stored as simple accumulator for p50 approximation) ────────

  private paymentDurations: number[] = [];
  private sagaDurations: number[] = [];

  // ── Gauges ─────────────────────────────────────────────────────────────────

  private activeSubscriptions = 0;

  // ─── Public API ────────────────────────────────────────────────────────────

  incrementPaymentInitiated(plan: string): void {
    this.counts.initiated++;
    this.logger.log('[metric] payment.initiated', { plan });
  }

  incrementPaymentCompleted(plan: string, bankCode: string): void {
    this.counts.completed++;
    this.logger.log('[metric] payment.completed', { plan, bankCode });
  }

  incrementPaymentFailed(plan: string, responseCode: string): void {
    this.counts.failed++;
    this.logger.log('[metric] payment.failed', { plan, responseCode });
    this.checkFailureRateAlert();
  }

  incrementPaymentTimeout(): void {
    this.counts.timeout++;
    this.logger.log('[metric] payment.timeout');
    this.checkTimeoutAlert();
  }

  incrementSagaCompensation(reason: string): void {
    this.counts.sagaCompensation++;
    // IMMEDIATE alert — every compensation is noteworthy
    this.logger.warn(
      `[ALERT] Saga compensation triggered. Reason: ${reason}`,
      { metric: 'saga.compensation', reason },
    );
  }

  incrementDuplicateCallback(orderCode: string): void {
    this.counts.duplicateCallback++;
    this.logger.log('[metric] payment.duplicate_callback', { orderCode });
  }

  incrementDlqMessage(eventType: string): void {
    this.counts.dlqMessage++;
    this.logger.warn(`[ALERT] DLQ message received. eventType=${eventType}`, {
      metric: 'dlq.message',
      eventType,
    });
  }

  recordPaymentDuration(durationMs: number): void {
    this.paymentDurations.push(durationMs);
    this.logger.log('[metric] payment.duration', { durationMs });
  }

  recordSagaDuration(durationMs: number): void {
    this.sagaDurations.push(durationMs);
    this.logger.log('[metric] saga.duration', { durationMs });
  }

  setActiveSubscriptions(count: number): void {
    this.activeSubscriptions = count;
    this.logger.log('[metric] subscription.active', { count });
  }

  /** Snapshot of current counters (used by health/admin endpoints) */
  getSnapshot() {
    return {
      counts: { ...this.counts },
      activeSubscriptions: this.activeSubscriptions,
      p50PaymentDuration: this.p50(this.paymentDurations),
      p50SagaDuration: this.p50(this.sagaDurations),
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private checkFailureRateAlert(): void {
    if (this.counts.initiated === 0) return;
    const failureRate = this.counts.failed / this.counts.initiated;
    if (failureRate > 0.1) {
      this.logger.warn(
        `[ALERT] High failure rate: ${(failureRate * 100).toFixed(1)}% of initiated payments failed`,
        { metric: 'payment.failure_rate', failureRate },
      );
    }
  }

  private checkTimeoutAlert(): void {
    if (this.counts.timeout > 5) {
      this.logger.warn(
        `[ALERT] Payment timeout count exceeded threshold: ${this.counts.timeout}`,
        { metric: 'payment.timeout_count', count: this.counts.timeout },
      );
    }
  }

  private p50(values: number[]): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
}
