import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { RedisService } from '@app/common';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      setNX: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    redisService = module.get(RedisService) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAndAcquire', () => {
    it('should return first_time if setNX returns true', async () => {
      redisService.setNX.mockResolvedValue(true);
      const result = await service.checkAndAcquire('txn_123', 86400);
      
      expect(result).toBe('first_time');
      expect(redisService.setNX).toHaveBeenCalledWith('idempotency:txn_123', 'processing', 86400);
    });

    it('should return duplicate if setNX returns false', async () => {
      redisService.setNX.mockResolvedValue(false);
      const result = await service.checkAndAcquire('txn_456', 86400);
      
      expect(result).toBe('duplicate');
      expect(redisService.setNX).toHaveBeenCalledWith('idempotency:txn_456', 'processing', 86400);
    });
  });

  describe('release', () => {
    it('should delete the idempotency key', async () => {
      redisService.delete.mockResolvedValue(undefined);
      await service.release('txn_789');
      
      expect(redisService.delete).toHaveBeenCalledWith('idempotency:txn_789');
    });
  });
});
