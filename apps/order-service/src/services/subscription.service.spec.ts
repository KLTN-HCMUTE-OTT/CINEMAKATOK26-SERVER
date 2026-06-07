import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  SubscriptionStatus,
  SubscriptionPlan,
} from '@app/common/enums/global.enum';

import { SubscriptionService } from './subscription.service';
import { EntitySubscription } from '../entities/subscription.entity';
import { EntitySubscriptionPlan } from '../entities/subscription-plan.entity';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let planRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    subscriptionRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 'sub1', ...entity })),
      update: jest.fn(),
    };
    planRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(EntitySubscription, 'order'),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(EntitySubscriptionPlan, 'order'),
          useValue: planRepo,
        },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkSubscription', () => {
    it('reports inactive when no active subscription exists', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.checkSubscription('u1')).resolves.toEqual({
        isActive: false,
      });
    });

    it('reports the plan and expiry when an active subscription exists', async () => {
      const expiresAt = new Date('2030-01-01');
      subscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'premium' },
        expiresAt,
      });

      await expect(service.checkSubscription('u1')).resolves.toEqual({
        isActive: true,
        plan: 'premium',
        expiresAt,
      });
    });
  });

  describe('createSubscription', () => {
    it('returns the existing subscription instead of creating a duplicate', async () => {
      const existing = { id: 'existing', expiresAt: new Date() };
      subscriptionRepo.findOne.mockResolvedValue(existing);

      const result = await service.createSubscription('u1');

      expect(result).toBe(existing);
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
    });

    it('throws when the requested plan does not exist', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscription('u1', SubscriptionPlan.PREMIUM),
      ).rejects.toThrow(/not found/);
    });

    it('creates an active subscription when none exists', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue({ name: 'basic' });

      const result = await service.createSubscription(
        'u1',
        SubscriptionPlan.BASIC,
        30,
      );

      expect(subscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          status: SubscriptionStatus.ACTIVE,
        }),
      );
      expect(result).toMatchObject({ id: 'sub1' });
    });
  });

  describe('cancelSubscription', () => {
    it('returns null when there is no active subscription to cancel', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelSubscription('u1')).resolves.toBeNull();
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
    });

    it('flips an active subscription to CANCELLED', async () => {
      const sub = { id: 's1', status: SubscriptionStatus.ACTIVE };
      subscriptionRepo.findOne.mockResolvedValue(sub);

      await service.cancelSubscription('u1');

      expect(sub.status).toBe(SubscriptionStatus.CANCELLED);
      expect(subscriptionRepo.save).toHaveBeenCalledWith(sub);
    });
  });

  describe('activateSubscription', () => {
    it('throws when the plan is unknown', async () => {
      planRepo.findOne.mockResolvedValue(null);

      await expect(
        service.activateSubscription({
          userId: 'u1',
          plan: 'ghost',
          durationDays: 30,
          paymentId: 'p1',
          paymentType: 'new',
        }),
      ).rejects.toThrow(/Plan ghost not found/);
    });

    it('cancels the previous active subscription on upgrade then creates a new one', async () => {
      planRepo.findOne.mockResolvedValue({ name: 'premium' });

      await service.activateSubscription({
        userId: 'u1',
        plan: 'premium',
        durationDays: 30,
        paymentId: 'p1',
        paymentType: 'upgrade',
      });

      expect(subscriptionRepo.update).toHaveBeenCalledWith(
        { userId: 'u1', status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.CANCELLED },
      );
      expect(subscriptionRepo.create).toHaveBeenCalled();
    });

    it('extends the existing expiry on renewal', async () => {
      planRepo.findOne.mockResolvedValue({ name: 'premium' });
      const existing = {
        id: 's1',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      };
      subscriptionRepo.findOne.mockResolvedValue(existing);

      await service.activateSubscription({
        userId: 'u1',
        plan: 'premium',
        durationDays: 10,
        paymentId: 'p1',
        paymentType: 'renewal',
      });

      expect(existing.expiresAt.getTime()).toBe(
        new Date('2030-01-11T00:00:00Z').getTime(),
      );
      expect(subscriptionRepo.save).toHaveBeenCalledWith(existing);
      expect(subscriptionRepo.create).not.toHaveBeenCalled();
    });
  });
});
