import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../services/redis.service';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Checks if an operation has already been executed using a Redis NX lock.
   *
   * @param key The idempotency key (e.g., vnp_TxnRef)
   * @param ttlSeconds TTL in seconds (default 24 hours)
   * @returns 'first_time' if lock acquired, 'duplicate' if already exists
   */
  async checkAndAcquire(key: string, ttlSeconds = 86400): Promise<'first_time' | 'duplicate'> {
    const fullKey = `idempotency:${key}`;
    const acquired = await this.redisService.setNX(fullKey, 'processing', ttlSeconds);
    
    if (acquired) {
      this.logger.log(`Acquired idempotency key: ${fullKey}`);
      return 'first_time';
    } else {
      this.logger.warn(`Duplicate request detected for idempotency key: ${fullKey}`);
      return 'duplicate';
    }
  }

  /**
   * Releases the idempotency lock. Used primarily for rollbacks on failure.
   */
  async release(key: string): Promise<void> {
    const fullKey = `idempotency:${key}`;
    await this.redisService.delete(fullKey);
    this.logger.log(`Released idempotency key: ${fullKey}`);
  }
}
