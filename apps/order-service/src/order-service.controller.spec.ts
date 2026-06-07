import { Test, TestingModule } from '@nestjs/testing';

import { OrderServiceController } from './order-service.controller';
import { SubscriptionService } from './services/subscription.service';

describe('OrderServiceController', () => {
  let controller: OrderServiceController;
  let service: jest.Mocked<SubscriptionService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<SubscriptionService>> = {
      getPlanByName: jest.fn(),
      checkSubscription: jest.fn(),
      getSubscription: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      activateSubscription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderServiceController],
      providers: [{ provide: SubscriptionService, useValue: serviceMock }],
    }).compile();

    controller = module.get(OrderServiceController);
    service = module.get(SubscriptionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getPlanByName delegates with the plan name', () => {
    controller.getPlanByName({ name: 'premium' });
    expect(service.getPlanByName).toHaveBeenCalledWith('premium');
  });

  it('checkSubscription delegates with the userId', () => {
    controller.checkSubscription({ userId: 'u1' });
    expect(service.checkSubscription).toHaveBeenCalledWith('u1');
  });

  describe('createSubscription routing', () => {
    it('routes a plain creation to createSubscription', () => {
      controller.createSubscription({
        userId: 'u1',
        plan: undefined,
        durationDays: 30,
      });

      expect(service.createSubscription).toHaveBeenCalledWith('u1', undefined, 30);
      expect(service.activateSubscription).not.toHaveBeenCalled();
    });

    it('routes an upgrade to activateSubscription with normalized args', () => {
      controller.createSubscription({
        userId: 'u1',
        plan: 'premium' as never,
        paymentType: 'upgrade',
        paymentId: 'pay-1',
      });

      expect(service.activateSubscription).toHaveBeenCalledWith({
        userId: 'u1',
        plan: 'premium',
        durationDays: 30, // defaulted
        paymentId: 'pay-1',
        paymentType: 'upgrade',
      });
      expect(service.createSubscription).not.toHaveBeenCalled();
    });

    it('routes a renewal to activateSubscription', () => {
      controller.createSubscription({
        userId: 'u1',
        plan: 'basic' as never,
        paymentType: 'renewal',
        durationDays: 90,
        paymentId: 'pay-2',
      });

      expect(service.activateSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ paymentType: 'renewal', durationDays: 90 }),
      );
    });
  });

  it('activateSubscription (saga pattern) forwards the payload verbatim', () => {
    const payload = {
      userId: 'u1',
      plan: 'premium',
      durationDays: 30,
      paymentId: 'p1',
      paymentType: 'new',
    };
    controller.activateSubscription(payload);
    expect(service.activateSubscription).toHaveBeenCalledWith(payload);
  });
});
