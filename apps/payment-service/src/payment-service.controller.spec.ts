import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';

import { PaymentServiceController } from './payment-service.controller';
import { PaymentService } from './services/payment.service';
import { PaymentCallbackService } from './services/payment-callback.service';
import { PaymentHealthService } from './health/payment.health';

describe('PaymentServiceController', () => {
  let controller: PaymentServiceController;
  let paymentService: jest.Mocked<PaymentService>;
  let callbackService: jest.Mocked<PaymentCallbackService>;
  let healthService: jest.Mocked<PaymentHealthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentServiceController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            initPayment: jest.fn(),
            getHistory: jest.fn(),
            getPaymentById: jest.fn(),
            handleDeadLetter: jest.fn(),
          },
        },
        {
          provide: PaymentCallbackService,
          useValue: { handleIpnCallback: jest.fn() },
        },
        { provide: PaymentHealthService, useValue: { healthCheck: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PaymentServiceController);
    paymentService = module.get(PaymentService);
    callbackService = module.get(PaymentCallbackService);
    healthService = module.get(PaymentHealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('initPayment forwards the payload to PaymentService', () => {
    const payload = { userId: 'u1', amount: 1000 };
    controller.initPayment(payload);
    expect(paymentService.initPayment).toHaveBeenCalledWith(payload);
  });

  it('handleCallback routes to the callback service', () => {
    const payload = { vnp_ResponseCode: '00' };
    controller.handleCallback(payload);
    expect(callbackService.handleIpnCallback).toHaveBeenCalledWith(payload);
  });

  it('getHistory unwraps userId, page and limit', () => {
    controller.getHistory({ userId: 'u1', page: 2, limit: 5 });
    expect(paymentService.getHistory).toHaveBeenCalledWith('u1', 2, 5);
  });

  it('getById passes userId and paymentId through', () => {
    controller.getById({ userId: 'u1', paymentId: 'p1' });
    expect(paymentService.getPaymentById).toHaveBeenCalledWith('u1', 'p1');
  });

  it('healthCheck delegates to the health service', () => {
    controller.healthCheck();
    expect(healthService.healthCheck).toHaveBeenCalledTimes(1);
  });

  it('handleDeadLetter persists then ACKs the message', () => {
    const ack = jest.fn();
    const message = { content: 'dlq' };
    const context = {
      getChannelRef: () => ({ ack }),
      getMessage: () => message,
    } as unknown as RmqContext;

    controller.handleDeadLetter({ event: 'payment.failed' }, context);

    expect(paymentService.handleDeadLetter).toHaveBeenCalledWith({
      event: 'payment.failed',
    });
    expect(ack).toHaveBeenCalledWith(message);
  });
});
