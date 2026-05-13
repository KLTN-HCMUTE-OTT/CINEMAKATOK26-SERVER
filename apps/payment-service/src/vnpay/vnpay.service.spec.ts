import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VnpayService } from './vnpay.service';

describe('VnpayService', () => {
  let service: VnpayService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VnpayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const env = {
                VNPAY_TMN_CODE: 'TESTCODE',
                VNPAY_HASH_SECRET: 'TESTSECRET1234567890TESTSECRET12',
                VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
              };
              return env[key as keyof typeof env];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VnpayService>(VnpayService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentUrl', () => {
    it('should generate a valid URL with the correct structure', () => {
      const result = service.createPaymentUrl({
        amount: 100000,
        orderCode: 'ORDER123',
        returnUrl: 'https://example.com/return',
        ipAddress: '127.0.0.1',
      });

      expect(result).toContain('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?');
      expect(result).toContain('vnp_Amount=10000000'); // 100000 * 100
      expect(result).toContain('vnp_TmnCode=TESTCODE');
      expect(result).toContain('vnp_TxnRef=ORDER123');
      expect(result).toContain('vnp_SecureHash=');
    });
  });

  describe('verifyCallback', () => {
    it('should return true for a valid signature', () => {
      const payload: Record<string, string> = {
        vnp_Amount: '10000000',
        vnp_BankCode: 'NCB',
        vnp_OrderInfo: 'Order 123',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'TESTCODE',
        vnp_TxnRef: 'ORDER123',
      };
      
      const signData = (service as any).buildQueryString(payload);
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha512', 'TESTSECRET1234567890TESTSECRET12');
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      payload['vnp_SecureHash'] = signed;
      payload['vnp_SecureHashType'] = 'SHA512';

      expect(service.verifyCallback(payload)).toBe(true);
    });

    it('should return false if signature is tampered', () => {
      const payload: Record<string, string> = {
        vnp_Amount: '10000000',
        vnp_BankCode: 'NCB',
        vnp_OrderInfo: 'Order 123',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'TESTCODE',
        vnp_TxnRef: 'ORDER123',
        vnp_SecureHash: 'invalid_signature_here',
      };

      expect(service.verifyCallback(payload)).toBe(false);
    });
  });

  describe('isSuccessResponse', () => {
    it('should return true for "00"', () => {
      expect(service.isSuccessResponse('00')).toBe(true);
    });

    it('should return false for other codes', () => {
      expect(service.isSuccessResponse('07')).toBe(false);
      expect(service.isSuccessResponse('24')).toBe(false);
    });
  });

  describe('getResponseMessage', () => {
    it('should return correct Vietnamese string', () => {
      expect(service.getResponseMessage('00')).toBe('Giao dịch thành công');
      expect(service.getResponseMessage('24')).toContain('hủy giao dịch');
      expect(service.getResponseMessage('unknown')).toContain('Lỗi không xác định');
    });
  });
});
