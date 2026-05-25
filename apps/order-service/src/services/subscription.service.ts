import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';

import {
  EntitySubscription
} from '../entities/subscription.entity';
import { EntitySubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionStatus, SubscriptionPlan } from '@app/common/enums/global.enum';


@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(EntitySubscription, 'order')
    private readonly subscriptionRepo: Repository<EntitySubscription>,
    @InjectRepository(EntitySubscriptionPlan, 'order')
    private readonly planRepo: Repository<EntitySubscriptionPlan>,
  ) {}

  /**
   * Get a subscription plan by its unique name (e.g., 'basic', 'premium').
   */
  async getPlanByName(name: string): Promise<EntitySubscriptionPlan | null> {
    return this.planRepo.findOne({ where: { name } });
  }

  /**
   * Check if a user has an active, non-expired subscription.
   * Used by the DRM license server for entitlement validation.
   */
  async checkSubscription(
    userId: string,
  ): Promise<{ isActive: boolean; plan?: string; expiresAt?: Date }> {
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: MoreThanOrEqual(new Date()),
      },
      order: { expiresAt: 'DESC' },
      relations: ['plan'],
    });

    if (!subscription) {
      this.logger.debug(`No active subscription found for user ${userId}`);
      return { isActive: false };
    }

    this.logger.debug(
      `Active subscription found for user ${userId}: plan=${subscription.plan?.name}, expires=${subscription.expiresAt}`,
    );

    return {
      isActive: true,
      plan: subscription.plan?.name,
      expiresAt: subscription.expiresAt,
    };
  }

  /**
   * Create or renew a subscription for a user.
   * For the academic project, this is a simplified subscription creation.
   */
  async createSubscription(
    userId: string,
    plan: SubscriptionPlan = SubscriptionPlan.BASIC,
    durationDays: number = 30,
  ): Promise<EntitySubscription> {
    // Check for existing active subscription
    const existing = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: MoreThanOrEqual(new Date()),
      },
    });

    if (existing) {
      this.logger.log(
        `User ${userId} already has an active subscription until ${existing.expiresAt}`,
      );
      return existing;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const planEntity = await this.planRepo.findOne({
      where: { name: plan },
    });

    if (!planEntity) {
      throw new Error(`Subscription plan ${plan} not found in database`);
    }

    const subscription = this.subscriptionRepo.create({
      userId,
      plan: planEntity,
      status: SubscriptionStatus.ACTIVE,
      startsAt: now,
      expiresAt,
    });

    const saved = await this.subscriptionRepo.save(subscription);
    this.logger.log(
      `Created ${plan} subscription for user ${userId}, expires ${expiresAt}`,
    );

    return saved;
  }

  /**
   * Get the current subscription for a user.
   */
  async getSubscription(userId: string): Promise<EntitySubscription | null> {
    return this.subscriptionRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['plan']
    });
  }

  /**
   * Cancel a user's subscription.
   */
  async cancelSubscription(userId: string): Promise<EntitySubscription | null> {
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      return null;
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    return this.subscriptionRepo.save(subscription);
  }

  /**
   * Activate a subscription from PaymentSaga.
   * Handles new, renewal, and upgrade payment types.
   */
  async activateSubscription(payload: {
    userId: string;
    plan: string;
    durationDays: number;
    paymentId: string;
    paymentType: string;
    previousPlan?: string;
  }): Promise<EntitySubscription> {
    const { userId, plan, durationDays, paymentId, paymentType } = payload;
    
    // Find plan entity
    const planEntity = await this.planRepo.findOne({ where: { name: plan } });
    if (!planEntity) throw new Error(`Plan ${plan} not found`);

    if (paymentType === 'upgrade') {
      // Cancel existing active subscription
      await this.subscriptionRepo.update(
        { userId, status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.CANCELLED }
      );
    } else if (paymentType === 'renewal') {
      const existing = await this.subscriptionRepo.findOne({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        order: { expiresAt: 'DESC' },
        relations: ['plan'],
      });
      if (existing) {
        existing.expiresAt = new Date(existing.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        return this.subscriptionRepo.save(existing);
      }
    }

    // Default 'new' or fallback if renewal found nothing
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const sub = this.subscriptionRepo.create({
      userId,
      plan: planEntity,
      status: SubscriptionStatus.ACTIVE,
      startsAt: now,
      expiresAt,
      paymentId,
    });
    return this.subscriptionRepo.save(sub);
  }
}
