import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { EntitySubscription, SubscriptionStatus } from '../entities/subscription.entity';
import { EntitySubscriptionPlan } from '../entities/subscription-plan.entity';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(
    @InjectRepository(EntitySubscription, 'order')
    private readonly subscriptionRepo: Repository<EntitySubscription>,
    @InjectRepository(EntitySubscriptionPlan, 'order')
    private readonly planRepo: Repository<EntitySubscriptionPlan>,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireSubscriptions() {
    this.logger.log('Running expireSubscriptions cron job...');
    try {
      const now = new Date();
      
      const plans = await this.planRepo.find();
      const planMap = new Map(plans.map(p => [p.id, p.name]));

      const result = await this.subscriptionRepo
        .createQueryBuilder()
        .update(EntitySubscription)
        .set({ status: SubscriptionStatus.EXPIRED })
        .where('status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('expiresAt <= :now', { now })
        .returning(['id', 'userId', 'planId', 'expiresAt'])
        .execute();

      const expiredSubs = result.raw as any[];
      this.logger.log(`Expired ${expiredSubs.length} subscriptions`);

      for (const sub of expiredSubs) {
        try {
          this.notificationClient.emit('subscription.expired', {
            userId: sub.userId,
            subscriptionId: sub.id,
            plan: planMap.get(sub.planId || sub.plan_id) || 'unknown',
            expiredAt: sub.expiresAt || sub.expires_at,
          });
        } catch (err) {
          this.logger.error(`Failed to emit expiration for ${sub.id}`, err.stack);
        }
      }
    } catch (error) {
      this.logger.error('Error in expireSubscriptions', error.stack);
    }
  }

  @Cron('0 9 * * *')
  async sendExpirationReminders() {
    this.logger.log('Running sendExpirationReminders cron job...');
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const expiringSubs = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .leftJoinAndSelect('sub.plan', 'plan')
        .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('sub.expiresAt > :now', { now })
        .andWhere('sub.expiresAt <= :threeDays', { threeDays: threeDaysFromNow })
        .getMany();

      for (const sub of expiringSubs) {
        try {
          const reminderKey = `reminder:sent:${sub.id}`;
          const alreadySent = await this.redisService.setNx(reminderKey, '1', 23 * 60 * 60); // 23h TTL
          
          if (alreadySent) {
            const daysLeft = Math.ceil((sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            this.notificationClient.emit('subscription.expiring_soon', {
              userId: sub.userId,
              plan: sub.plan?.name,
              expiresAt: sub.expiresAt,
              daysLeft,
            });
          }
        } catch (err) {
          this.logger.error(`Failed to send reminder for ${sub.id}`, err.stack);
        }
      }
    } catch (error) {
      this.logger.error('Error in sendExpirationReminders', error.stack);
    }
  }
}
