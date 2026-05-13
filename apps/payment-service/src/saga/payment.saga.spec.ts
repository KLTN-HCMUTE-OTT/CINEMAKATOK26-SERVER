import { Test, TestingModule } from '@nestjs/testing';
import { PaymentSaga } from './payment.saga';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentEntity, PaymentStatus, PaymentType, PaymentPlan } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { of, throwError } from 'rxjs';

describe('PaymentSaga', () => {
  let saga: PaymentSaga;
  let paymentRepo: any;
  let sagaEventLogRepo: any;
  let orderClient: any;
  let notificationClient: any;

  beforeEach(async () => {
    paymentRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    sagaEventLogRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn(),
    };

    orderClient = {
      send: jest.fn(),
    };

    notificationClient = {
      emit: jest.fn(),
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
          provide: 'ORDER_SERVICE',
          useValue: orderClient,
        },
        {
          provide: 'NOTIFICATION_SERVICE',
          useValue: notificationClient,
        },
      ],
    }).compile();

    saga = module.get<PaymentSaga>(PaymentSaga);
  });

  const mockPayment = {
    id: 'pay-123',
    userId: 'user-123',
    sagaId: 'saga-123',
    plan: PaymentPlan.PREMIUM,
    paymentType: PaymentType.UPGRADE,
    durationDays: 30,
    amount: 100000,
  } as PaymentEntity;

  it('should be defined', () => {
    expect(saga).toBeDefined();
  });

  it('should execute all steps successfully in order', async () => {
    paymentRepo.findOne.mockResolvedValue(mockPayment);
    orderClient.send.mockReturnValue(of({ id: 'sub-123' }));

    await saga.execute('pay-123');

    // Step 1: Complete payment
    expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pay-123',
      status: PaymentStatus.COMPLETED,
      sagaStatus: 'processing'
    }));

    // Step 2: Activate subscription (TCP call)
    expect(orderClient.send).toHaveBeenCalledWith('subscription.activate', {
      userId: 'user-123',
      plan: PaymentPlan.PREMIUM,
      durationDays: 30,
      paymentId: 'pay-123',
      paymentType: PaymentType.UPGRADE,
      previousPlan: 'basic',
    });

    // Step 3: Link subscription
    expect(paymentRepo.update).toHaveBeenCalledWith('pay-123', {
      subscriptionId: 'sub-123',
      sagaStatus: 'completed'
    });

    // Step 4: Notify
    expect(notificationClient.emit).toHaveBeenCalledWith('payment.success', expect.any(Object));

    // Logging checks
    expect(sagaEventLogRepo.save).toHaveBeenCalledTimes(4); // complete, activate, link, notify
  });

  it('should compensate if subscription activation fails', async () => {
    paymentRepo.findOne.mockResolvedValue(mockPayment);
    orderClient.send.mockReturnValue(throwError(() => new Error('Activation failed')));

    await saga.execute('pay-123');

    // Should have tried to save payment
    expect(paymentRepo.save).toHaveBeenCalled();

    // Should have marked for compensation
    expect(paymentRepo.update).toHaveBeenCalledWith('pay-123', {
      sagaStatus: 'compensation_needed'
    });

    // Should emit alert
    expect(notificationClient.emit).toHaveBeenCalledWith('payment.saga.failed', expect.objectContaining({
      paymentId: 'pay-123',
      error: 'Activation failed'
    }));

    // Should log steps + compensation
    expect(sagaEventLogRepo.save).toHaveBeenCalled();
    const saveCalls = sagaEventLogRepo.save.mock.calls;
    expect(saveCalls[saveCalls.length - 1][0]).toEqual(expect.objectContaining({
      status: 'compensation_completed'
    }));
  });
});
