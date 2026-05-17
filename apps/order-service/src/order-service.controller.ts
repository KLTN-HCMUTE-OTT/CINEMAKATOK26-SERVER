import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { SubscriptionService } from './services/subscription.service';
import { SubscriptionPlan } from './entities/subscription.entity';

@Controller()
export class OrderServiceController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // ─── Subscription ─────────────────────────────────────────────────────────────

  /**
   * Check if a user has an active subscription.
   * Called by streaming-service DrmLicenseService during license issuance.
   */
  @MessagePattern({ cmd: 'order.checkSubscription' })
  checkSubscription(@Payload() payload: { userId: string }) {
    return this.subscriptionService.checkSubscription(payload.userId);
  }

  /**
   * Get the current subscription details for a user.
   */
  @MessagePattern({ cmd: 'order.getSubscription' })
  getSubscription(@Payload() payload: { userId: string }) {
    return this.subscriptionService.getSubscription(payload.userId);
  }

  /**
   * Create or renew a subscription.
   */
  @MessagePattern({ cmd: 'order.createSubscription' })
  createSubscription(
    @Payload()
    payload: {
      userId: string;
      plan?: SubscriptionPlan;
      durationDays?: number;
      paymentId?: string;
      paymentType?: string;
    },
  ) {
    // If paymentType is upgrade or renewal, use activateSubscription for proper handling
    if (payload.paymentType === 'upgrade' || payload.paymentType === 'renewal') {
      return this.subscriptionService.activateSubscription({
        userId: payload.userId,
        plan: payload.plan as string,
        durationDays: payload.durationDays ?? 30,
        paymentId: payload.paymentId ?? '',
        paymentType: payload.paymentType,
      });
    }
    return this.subscriptionService.createSubscription(
      payload.userId,
      payload.plan,
      payload.durationDays,
    );
  }

  /**
   * Cancel a user's subscription.
   */
  @MessagePattern({ cmd: 'order.cancelSubscription' })
  cancelSubscription(@Payload() payload: { userId: string }) {
    return this.subscriptionService.cancelSubscription(payload.userId);
  }

  /**
   * Activate, extend or upgrade a subscription (called by PaymentSaga).
   */
  @MessagePattern('subscription.activate')
  activateSubscription(
    @Payload()
    payload: {
      userId: string;
      plan: string;
      durationDays: number;
      paymentId: string;
      paymentType: string;
      previousPlan?: string;
    },
  ) {
    return this.subscriptionService.activateSubscription(payload);
  }
}
