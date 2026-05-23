import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@app/common';
import { Redis } from 'ioredis';
import { createHash, randomUUID } from 'crypto';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface EntitlementDto {
  plan: string;
  expiresAt: string;
  isActive: boolean;
}

export interface PlanPricingDto {
  basic: number;
  premium: number;
}

// ─── Redis key patterns & TTLs ───────────────────────────────────────────────

const KEYS = {
  entitlement: (userId: string) => `entitlement:${userId}`,
  idempotency: (key: string) => `idempotency:payment:${key}`,
  vnpayCallback: (orderCode: string, txnNo: string) =>
    `vnpay:callback:${orderCode}:${txnNo}`,
  sagaLock: (sagaId: string) => `saga:lock:${sagaId}`,
  planPricing: () => 'plan:pricing',
  paymentPending: (orderCode: string) => `payment:pending:${orderCode}`,
} as const;

const TTL = {
  ENTITLEMENT: 300,       // 5 min
  IDEMPOTENCY: 86_400,    // 24 h
  VNPAY_CALLBACK: 3_600,  // 1 h
  SAGA_LOCK: 30,          // 30 s
  PLAN_PRICING: 3_600,    // 1 h
  PAYMENT_PENDING: 900,   // 15 min
} as const;

// Lua script: only the lock owner can release the key
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * RedisCacheService
 *
 * Typed cache operations for the payment domain.
 * All keys and TTLs follow the spec in vnpay-part3-prompt.md §9.1.
 */
@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;

  /** Tracks lock tokens in-memory so `releaseSagaLock` can pass the correct token */
  private lockTokens = new Map<string, string>();

  constructor(private readonly redisService: RedisService) {
    this.client = this.redisService.client;
  }

  // ─── Entitlement cache ─────────────────────────────────────────────────────

  async getEntitlement(userId: string): Promise<EntitlementDto | null> {
    const raw = await this.client.get(KEYS.entitlement(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EntitlementDto;
    } catch {
      return null;
    }
  }

  async setEntitlement(userId: string, data: EntitlementDto): Promise<void> {
    await this.client.set(
      KEYS.entitlement(userId),
      JSON.stringify(data),
      'EX',
      TTL.ENTITLEMENT,
    );
  }

  async invalidateEntitlement(userId: string): Promise<void> {
    await this.client.del(KEYS.entitlement(userId));
  }

  // ─── Idempotency cache ─────────────────────────────────────────────────────

  async checkIdempotency(key: string): Promise<any | null> {
    const raw = await this.client.get(KEYS.idempotency(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async setIdempotency(key: string, result: any): Promise<void> {
    await this.client.set(
      KEYS.idempotency(key),
      JSON.stringify(result),
      'EX',
      TTL.IDEMPOTENCY,
    );
  }

  // ─── VNPAY callback dedup ─────────────────────────────────────────────────

  /** Returns false when the key already existed (duplicate callback). */
  async markCallbackProcessed(
    orderCode: string,
    txnNo: string,
  ): Promise<boolean> {
    const result = await this.client.set(
      KEYS.vnpayCallback(orderCode, txnNo),
      '1',
      'EX',
      TTL.VNPAY_CALLBACK,
      'NX',
    );
    return result === 'OK';
  }

  // ─── Distributed lock ─────────────────────────────────────────────────────

  async acquireSagaLock(sagaId: string): Promise<boolean> {
    const token = randomUUID();
    const result = await this.client.set(
      KEYS.sagaLock(sagaId),
      token,
      'EX',
      TTL.SAGA_LOCK,
      'NX',
    );
    const acquired = result === 'OK';
    if (acquired) {
      this.lockTokens.set(sagaId, token);
    }
    return acquired;
  }

  /** Release only if we own the lock (Lua CAS). */
  async releaseSagaLock(sagaId: string): Promise<void> {
    const token = this.lockTokens.get(sagaId);
    if (!token) return;
    await this.client.eval(
      RELEASE_LOCK_SCRIPT,
      1,
      KEYS.sagaLock(sagaId),
      token,
    );
    this.lockTokens.delete(sagaId);
  }

  // ─── Plan pricing ─────────────────────────────────────────────────────────

  async getPlanPricing(): Promise<PlanPricingDto | null> {
    const raw = await this.client.get(KEYS.planPricing());
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlanPricingDto;
    } catch {
      return null;
    }
  }

  async setPlanPricing(data: PlanPricingDto): Promise<void> {
    await this.client.set(
      KEYS.planPricing(),
      JSON.stringify(data),
      'EX',
      TTL.PLAN_PRICING,
    );
  }

  // ─── Payment pending tracking ──────────────────────────────────────────────

  async markPaymentPending(orderCode: string): Promise<void> {
    await this.client.set(
      KEYS.paymentPending(orderCode),
      '1',
      'EX',
      TTL.PAYMENT_PENDING,
    );
  }

  async clearPaymentPending(orderCode: string): Promise<void> {
    await this.client.del(KEYS.paymentPending(orderCode));
  }

  // ─── Low-level helpers (for tests & backward-compat) ─────────────────────

  async ping(): Promise<string> {
    return this.client.ping();
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

  // ─── Static helpers ───────────────────────────────────────────────────────

  /**
   * Auto-generate an idempotency key when the client did not supply
   * an `X-Idempotency-Key` header.
   *
   * Formula: sha256(userId + plan + Math.floor(Date.now() / 60_000))
   */
  static buildAutoIdempotencyKey(userId: string, plan: string): string {
    const minute = Math.floor(Date.now() / 60_000);
    return createHash('sha256')
      .update(`${userId}${plan}${minute}`)
      .digest('hex');
  }
}
