import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';

const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private lockTokens = new Map<string, string>();

  constructor(@Inject('REDIS_CLIENT') public readonly client: Redis) {}

  onModuleDestroy() {
    this.client?.disconnect();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delete(key: string): Promise<void> {
    return this.del(key);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /** Alias for setNx for backward compatibility with payment-service */
  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return this.setNx(key, value, ttlSeconds);
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const token = randomUUID();
    const result = await this.client.set(key, token, 'EX', ttlSeconds, 'NX');
    const acquired = result === 'OK';
    if (acquired) {
      this.lockTokens.set(key, token);
    }
    return acquired;
  }

  async releaseLock(key: string): Promise<void> {
    const token = this.lockTokens.get(key);
    if (!token) return;
    await this.client.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
    this.lockTokens.delete(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
