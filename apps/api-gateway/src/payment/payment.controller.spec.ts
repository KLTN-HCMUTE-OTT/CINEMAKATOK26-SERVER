import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { UnauthorizedException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { PaymentPlan } from '@app/common/dtos/payment/subscribe.dto';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: any;

  beforeEach(async () => {
    paymentService = {
      initPayment: jest.fn(),
      handleCallback: jest.fn(),
      getHistory: jest.fn(),
      getPlans: jest.fn(),
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

  describe('subscribe', () => {
    it('should call paymentService.initPayment and wrap with ResponseBuilder', async () => {
      const mockResponse = { paymentUrl: 'http://test.url', orderId: 'ord-123' };
      paymentService.initPayment.mockReturnValue(of(mockResponse));

      const result = await controller.subscribe('user-123', { plan: PaymentPlan.PREMIUM }, '127.0.0.1', 'test-agent');
      
      expect(result.data).toEqual(mockResponse);
      expect(result.message).toBe('Payment initiated successfully');
      expect(paymentService.initPayment).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', plan: 'premium', ipAddress: '127.0.0.1' })
      );
    });

    it('should let raw errors throw if paymentService throws', async () => {
      const mockError = { status: 400, message: 'Bad Request' };
      paymentService.initPayment.mockReturnValue(throwError(() => mockError));
      
      await expect(controller.subscribe('user-123', { plan: PaymentPlan.PREMIUM }, '127.0.0.1', 'test-agent'))
        .rejects
        .toEqual(mockError);
    });
  });

  describe('paymentCallback', () => {
    it('should redirect to success URL on RspCode 00', async () => {
      paymentService.handleCallback.mockReturnValue(of({ RspCode: '00', Message: 'Success' }));
      const res: any = { redirect: jest.fn() };
      
      process.env.FRONTEND_SUCCESS_URL = 'http://success';
      await controller.paymentCallback({ vnp_TxnRef: 'ord-123' }, res);
      
      expect(res.redirect).toHaveBeenCalledWith('http://success?vnp_TxnRef=ord-123');
    });

    it('should redirect to fail URL on non-00 RspCode', async () => {
      paymentService.handleCallback.mockReturnValue(of({ RspCode: '02', Message: 'Failed' }));
      const res: any = { redirect: jest.fn() };
      
      process.env.FRONTEND_FAIL_URL = 'http://fail';
      await controller.paymentCallback({ vnp_TxnRef: 'ord-123' }, res);
      
      expect(res.redirect).toHaveBeenCalledWith('http://fail?vnp_TxnRef=ord-123');
    });
  });

  describe('paymentIpn', () => {
    it('should return RspCode and Message on success', async () => {
      paymentService.handleCallback.mockReturnValue(of({ RspCode: '00', Message: 'Success' }));
      const req: any = { ip: '127.0.0.1', headers: {} };
      
      const result = await controller.paymentIpn({ vnp_TxnRef: 'ord-123' }, req);
      
      expect(result).toEqual({ RspCode: '00', Message: 'Success' });
    });

    it('should reject non-whitelisted IPs', async () => {
      process.env.VNPAY_IPN_IP = '192.168.1.1';
      const req: any = { ip: '10.0.0.1', headers: {} };
      
      await expect(controller.paymentIpn({ vnp_TxnRef: 'ord-123' }, req))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('getHistory', () => {
    it('should fetch from service and map to PaginatedApiResponse', async () => {
      paymentService.getHistory.mockReturnValue(of({ items: [{ id: 1 }], total: 1 }));
      
      const result = await controller.getHistory('user-123', { page: 1, limit: 20 });
      
      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.meta).toEqual({ currentPage: 1, itemCount: 1, itemsPerPage: 20, totalItems: 1, totalPages: 1 });
      expect(paymentService.getHistory).toHaveBeenCalledWith('user-123', 1, 20);
    });
  });

  describe('getPlans', () => {
    it('should fetch plans from service and wrap with ResponseBuilder', async () => {
      paymentService.getPlans.mockReturnValue(of([{ plan: 'basic' }]));
      
      const result = await controller.getPlans();
      
      expect(result.data).toEqual([{ plan: 'basic' }]);
      expect(paymentService.getPlans).toHaveBeenCalled();
    });
  });
});
