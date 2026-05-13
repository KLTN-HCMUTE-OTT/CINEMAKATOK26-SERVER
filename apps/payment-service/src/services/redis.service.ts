import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;
  private readonly logger = new Logger(RedisService.name);


  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl);
    this.redisClient.on('connect', () => this.logger.log('Connected to Redis'));
    this.redisClient.on('error', (err) => this.logger.error('Redis error', err));
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redisClient.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redisClient.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    return this.setNX(lockKey, 'locked', ttlSeconds);
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.delete(lockKey);
  }
}
