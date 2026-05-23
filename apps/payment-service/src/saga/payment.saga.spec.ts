import { Test, TestingModule } from '@nestjs/testing';
import { PaymentSaga, SagaStatus } from './payment.saga';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  PaymentEntity,
} from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { RedisService } from '@app/common';
import { of, throwError } from 'rxjs';
import {  PaymentStatus,
  PaymentType,
  PaymentPlan} from '@app/common/enums/global.enum'

/**
 * Unit tests for PaymentSaga.
 * Covers the public API: initializeSaga, continueAfterPayment, handlePaymentFailure.
 */
describe('PaymentSaga', () => {
  let saga: PaymentSaga;
  let paymentRepo: any;
  let sagaEventLogRepo: any;
  let outboxRepo: any;
  let orderClient: any;
  let notificationClient: any;
  let redisService: any;

  beforeEach(async () => {
    paymentRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      update: jest.fn(),
    };

    sagaEventLogRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
    };

    outboxRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
    };

    orderClient = {
      send: jest.fn(),
    };

    notificationClient = {
      emit: jest.fn(),
    };

    redisService = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentSaga,
        {
          provide: getRepositoryToken(PaymentEntity, 'payment'),
          useValue: paymentRepo,
        },
        {
          provide: getRepositoryToken(SagaEventLogEntity, 'payment'),
          useValue: sagaEventLogRepo,
        },
        {
          provide: getRepositoryToken(OutboxEvent, 'payment'),
          useValue: outboxRepo,
        },
        {
          provide: 'ORDER_SERVICE',
          useValue: orderClient,
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

    saga = module.get<PaymentSaga>(PaymentSaga);
    // Explicitly assign mocked redis reference just in case
    (saga as any).redis = redisService;
  });

  const mockPayment = {
    id: 'pay-123',
    userId: 'user-123',
    sagaId: 'saga-123',
    orderCode: 'CK20260514001',
    plan: PaymentPlan.PREMIUM,
    paymentType: PaymentType.UPGRADE,
    durationDays: 30,
    amount: 149000,
    currency: 'VND',
    status: PaymentStatus.COMPLETED,
    vnpayTxnNo: '14303538',
    bankCode: 'NCB',
    subscriptionId: null,
  } as unknown as PaymentEntity;

  it('should be defined', () => {
    expect(saga).toBeDefined();
  });

  // ─── initializeSaga ────────────────────────────────────────────────────────

  describe('initializeSaga', () => {
    it('should assign a sagaId and log CREATE_PAYMENT step', async () => {
      const payment = { ...mockPayment } as PaymentEntity;

      const sagaId = await saga.initializeSaga(payment);

      expect(sagaId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(payment.sagaId).toBe(sagaId);
      expect(payment.sagaStatus).toBe(SagaStatus.STARTED);
      expect(paymentRepo.save).toHaveBeenCalledWith(payment);
      expect(sagaEventLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ stepName: 'CREATE_PAYMENT', status: 'completed' }),
      );
    });
  });

  // ─── continueAfterPayment ──────────────────────────────────────────────────

  describe('continueAfterPayment', () => {
    const mockSubscription = {
      id: 'sub-123',
      plan: { name: 'premium' },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it('should run steps 3–6 and complete saga on success', async () => {
      orderClient.send.mockReturnValue(of(mockSubscription));

      await saga.continueAfterPayment({ ...mockPayment } as PaymentEntity);

      // Step 3: activate subscription via order-service
      expect(orderClient.send).toHaveBeenCalledWith(
        { cmd: 'order.createSubscription' },
        expect.objectContaining({ userId: 'user-123', plan: PaymentPlan.PREMIUM }),
      );

      // Step 4: entitlement cache updated
      expect(redisService.set).toHaveBeenCalledWith(
        'entitlement:user-123',
        expect.any(String),
        expect.any(Number),
      );

      // Step 5: notification emitted
      expect(notificationClient.emit).toHaveBeenCalledWith(
        'notification.sendPaymentSuccess',
        expect.objectContaining({ userId: 'user-123' }),
      );

      // Step 6: outbox event written
      expect(outboxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'payment',
          eventType: 'payment.completed',
        }),
      );

      // Lock acquired and released
      expect(redisService.acquireLock).toHaveBeenCalledWith('saga:lock:saga-123', 30);
      expect(redisService.releaseLock).toHaveBeenCalledWith('saga:lock:saga-123');
    });

    it('should compensate when subscription activation fails', async () => {
      orderClient.send.mockReturnValue(
        throwError(() => new Error('Activation failed')),
      );
      const payment = { ...mockPayment, subscriptionId: null } as unknown as PaymentEntity;

      await saga.continueAfterPayment(payment);

      // Entitlement cache should be invalidated as compensation
      expect(redisService.del).toHaveBeenCalledWith('entitlement:user-123');

      // Admin notification emitted
      expect(notificationClient.emit).toHaveBeenCalledWith(
        'notification.sendEmail',
        expect.objectContaining({ to: 'admin@cinemakatok.com' }),
      );

      // Saga marked as compensated/failed
      expect(payment.sagaStatus).toBe(SagaStatus.COMPENSATED);
      expect(payment.status).toBe(PaymentStatus.FAILED);

      // Lock is always released
      expect(redisService.releaseLock).toHaveBeenCalledWith('saga:lock:saga-123');
    });

    it('should return early if lock cannot be acquired', async () => {
      redisService.acquireLock.mockResolvedValue(false);

      await saga.continueAfterPayment({ ...mockPayment } as PaymentEntity);

      expect(orderClient.send).not.toHaveBeenCalled();
      expect(outboxRepo.save).not.toHaveBeenCalled();
    });

    it('should return early if payment has no sagaId', async () => {
      const payment = { ...mockPayment, sagaId: null } as unknown as PaymentEntity;
      await saga.continueAfterPayment(payment);
      expect(redisService.acquireLock).not.toHaveBeenCalled();
    });
  });

  // ─── handlePaymentFailure ──────────────────────────────────────────────────

  describe('handlePaymentFailure', () => {
    it('should mark saga as FAILED and log PAYMENT_FAILED step', async () => {
      const payment = { ...mockPayment } as PaymentEntity;

      await saga.handlePaymentFailure(payment, '51');

      expect(payment.sagaStatus).toBe(SagaStatus.FAILED);
      expect(paymentRepo.save).toHaveBeenCalledWith(payment);
      expect(sagaEventLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stepName: 'PAYMENT_FAILED',
          status: 'completed',
          payload: { responseCode: '51' },
        }),
      );
    });
  });
});
