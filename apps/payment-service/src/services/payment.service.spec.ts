import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RedisService } from '@app/common';

import { PaymentService } from './payment.service';
import { PaymentCallbackService } from './payment-callback.service';
import { VnpayService } from '../vnpay/vnpay.service';
import { PaymentSaga } from '../saga/payment.saga';
import { PaymentEntity } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { DlqEvent } from '../entities/dlq-event.entity';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: { findAndCount: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    paymentRepo = { findAndCount: jest.fn(), findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(PaymentEntity, 'payment'),
          useValue: paymentRepo,
        },
        {
          provide: getRepositoryToken(SagaEventLogEntity, 'payment'),
          useValue: {},
        },
        {
          provide: getRepositoryToken(DlqEvent, 'payment'),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        { provide: VnpayService, useValue: {} },
        { provide: PaymentSaga, useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: PaymentCallbackService, useValue: {} },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHistory', () => {
    it('returns mapped items with pagination metadata', async () => {
      paymentRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'p1',
            orderCode: 'OC1',
            plan: 'premium',
            amount: 1000,
            currency: 'VND',
            status: 'SUCCESS',
            paymentType: 'new',
          },
        ],
        1,
      ]);

      const result = await service.getHistory('u1', 1, 10);

      expect(paymentRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ id: 'p1', orderCode: 'OC1' });
    });
  });

  describe('getPaymentById', () => {
    it('returns null when the payment is not found for the user', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.getPaymentById('u1', 'missing')).resolves.toBeNull();
    });

    it('returns a mapped payment when found', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 'p1',
        orderCode: 'OC1',
        plan: 'premium',
        amount: 1000,
        currency: 'VND',
        status: 'SUCCESS',
      });

      const result = await service.getPaymentById('u1', 'p1');

      expect(paymentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'p1', userId: 'u1' },
      });
      expect(result).toMatchObject({ id: 'p1', orderCode: 'OC1' });
    });
  });
});
