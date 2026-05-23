import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { of, throwError } from 'rxjs';
import type { Request, Response } from 'express';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: any;

  beforeEach(async () => {
    paymentService = {
      initPayment: jest.fn(),
      handleIpnCallback: jest.fn(),
      getPaymentHistory: jest.fn(),
      getPaymentById: jest.fn(),
      getHealth: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: paymentService,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiateSubscription', () => {
    it('should call paymentService.initPayment and wrap with ResponseBuilder', async () => {
      const mockResponse = { paymentUrl: 'http://test.url', orderId: 'ord-123' };
      paymentService.initPayment.mockReturnValue(of(mockResponse));

      const req = {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent',
          'x-idempotency-key': 'idempotency-123',
        },
      } as any as Request;

      const result = await controller.initiateSubscription('user-123', { plan: 'premium' }, req);

      expect(result.data).toEqual(mockResponse);
      expect(result.message).toBe('Payment URL created');
      expect(paymentService.initPayment).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          plan: 'premium',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          idempotencyKey: 'idempotency-123',
        }),
      );
    });

    it('should let raw errors throw if paymentService throws', async () => {
      const mockError = { status: 400, message: 'Bad Request' };
      paymentService.initPayment.mockReturnValue(throwError(() => mockError));

      const req = {
        ip: '127.0.0.1',
        headers: {},
      } as any as Request;

      await expect(controller.initiateSubscription('user-123', { plan: 'premium' }, req))
        .rejects
        .toEqual(mockError);
    });
  });

  describe('vnpayIpn', () => {
    it('should return RspCode and Message on success', async () => {
      paymentService.handleIpnCallback.mockReturnValue(of({ RspCode: '00', Message: 'Success' }));

      const result = await controller.vnpayIpn({ vnp_TxnRef: 'ord-123' });

      expect(result).toEqual({ RspCode: '00', Message: 'Success' });
      expect(paymentService.handleIpnCallback).toHaveBeenCalledWith({ vnp_TxnRef: 'ord-123' });
    });
  });

  describe('vnpayReturn', () => {
    it('should redirect to success URL on RspCode 00', async () => {
      const res = { redirect: jest.fn() } as any as Response;
      process.env.CLIENT_ORIGIN = 'http://cinemakatok.vn';

      await controller.vnpayReturn({ vnp_ResponseCode: '00', vnp_TxnRef: 'ord-123' }, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://cinemakatok.vn/payment/result?status=success&orderCode=ord-123',
      );
    });

    it('should redirect to fail URL on non-00 RspCode', async () => {
      const res = { redirect: jest.fn() } as any as Response;
      process.env.CLIENT_ORIGIN = 'http://cinemakatok.vn';

      await controller.vnpayReturn({ vnp_ResponseCode: '99', vnp_TxnRef: 'ord-123' }, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://cinemakatok.vn/payment/result?status=failed&orderCode=ord-123',
      );
    });
  });

  describe('getHistory', () => {
    it('should fetch from service and wrap in ResponseBuilder', async () => {
      const mockHistory = { items: [{ id: 'payment-1' }], total: 1 };
      paymentService.getPaymentHistory.mockReturnValue(of(mockHistory));

      const result = await controller.getHistory('user-123', 1, 10);

      expect(result.data).toEqual(mockHistory);
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('user-123', 1, 10);
    });
  });

  describe('getById', () => {
    it('should fetch single payment detail and wrap in ResponseBuilder', async () => {
      const mockPayment = { id: 'payment-1', amount: 50000 };
      paymentService.getPaymentById.mockReturnValue(of(mockPayment));

      const result = await controller.getById('user-123', 'payment-1');

      expect(result.data).toEqual(mockPayment);
      expect(paymentService.getPaymentById).toHaveBeenCalledWith('user-123', 'payment-1');
    });
  });
});
