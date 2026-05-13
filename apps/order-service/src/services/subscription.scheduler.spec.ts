import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionScheduler } from './subscription.scheduler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntitySubscription, SubscriptionStatus } from '../entities/subscription.entity';
import { EntitySubscriptionPlan } from '../entities/subscription-plan.entity';
import { RedisService } from '../common/redis/redis.service';

describe('SubscriptionScheduler', () => {
  let scheduler: SubscriptionScheduler;
  let subscriptionRepo: any;
  let planRepo: any;
  let notificationClient: any;
  let redisService: any;

  beforeEach(async () => {
    subscriptionRepo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    planRepo = {
      find: jest.fn(),
    };

    notificationClient = {
      emit: jest.fn(),
    };

    redisService = {
      setNx: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionScheduler,
        {
          provide: getRepositoryToken(EntitySubscription, 'order'),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(EntitySubscriptionPlan, 'order'),
          useValue: planRepo,
        },
        {
          provide: 'NOTIFICATION_SERVICE',
          useValue: notificationClient,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    scheduler = module.get<SubscriptionScheduler>(SubscriptionScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('expireSubscriptions', () => {
    it('should bulk update expired records and emit events', async () => {
      planRepo.find.mockResolvedValue([{ id: 'plan-1', name: 'premium' }]);
      subscriptionRepo.execute.mockResolvedValue({
        raw: [
          { id: 'sub-1', userId: 'user-1', planId: 'plan-1', expiresAt: new Date() },
        ],
      });

      await scheduler.expireSubscriptions();

      expect(subscriptionRepo.update).toHaveBeenCalledWith(EntitySubscription);
      expect(subscriptionRepo.set).toHaveBeenCalledWith({ status: SubscriptionStatus.EXPIRED });
      expect(notificationClient.emit).toHaveBeenCalledWith('subscription.expired', {
        userId: 'user-1',
        subscriptionId: 'sub-1',
        plan: 'premium',
        expiredAt: expect.any(Date),
      });
    });

    it('should handle DB error gracefully without throwing', async () => {
      subscriptionRepo.execute.mockRejectedValue(new Error('DB connection failed'));
      await expect(scheduler.expireSubscriptions()).resolves.not.toThrow();
    });
  });

  describe('sendExpirationReminders', () => {
    it('should skip already-reminded subscriptions via Redis dedup check', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      subscriptionRepo.getMany.mockResolvedValue([
        { id: 'sub-1', userId: 'user-1', plan: { name: 'premium' }, expiresAt, status: SubscriptionStatus.ACTIVE },
      ]);
      redisService.setNx.mockResolvedValue(false); // Already sent

      await scheduler.sendExpirationReminders();

      expect(redisService.setNx).toHaveBeenCalledWith('reminder:sent:sub-1', '1', 23 * 60 * 60);
      expect(notificationClient.emit).not.toHaveBeenCalled();
    });

    it('should emit correct daysLeft value and set Redis key', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
      subscriptionRepo.getMany.mockResolvedValue([
        { id: 'sub-2', userId: 'user-2', plan: { name: 'premium' }, expiresAt, status: SubscriptionStatus.ACTIVE },
      ]);
      redisService.setNx.mockResolvedValue(true); // Not sent yet

      await scheduler.sendExpirationReminders();

      expect(redisService.setNx).toHaveBeenCalledWith('reminder:sent:sub-2', '1', 23 * 60 * 60);
      expect(notificationClient.emit).toHaveBeenCalledWith('subscription.expiring_soon', {
        userId: 'user-2',
        plan: 'premium',
        expiresAt,
        daysLeft: 3, // Math.ceil(2.5) -> 3
      });
    });
  });
});
