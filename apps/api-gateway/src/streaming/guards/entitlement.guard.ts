import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { firstValueFrom, timeout } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '@app/common';

// Plan tier mapping (fail-closed: undefined → 0 = free)
const PLAN_TIER: Record<string, number> = {
  free: 0,
  FREE: 0,
  basic: 1,
  BASIC: 1,
  premium: 2,
  PREMIUM: 2,
};

interface EntitlementCache {
  plan: string;
  expiresAt: string;
  isActive: boolean;
}

/**
 * EntitlementGuard
 *
 * Validates that the requesting user has an active subscription with a plan
 * tier that meets or exceeds the content's required tier.
 *
 * Algorithm:
 *  1. Resolve contentId (from request params videoId or request body contentId).
 *  2. Query CONTENT_SERVICE to resolve the required accessTier (BASIC, PREMIUM, etc.).
 *  3. Check Redis cache (`entitlement:{userId}`) — 5 min TTL.
 *  4. On cache miss → TCP call to order-service (`order.checkSubscription`).
 *  5. Refresh Redis cache (5 min TTL).
 *  6. FAIL-CLOSED: deny access on any error (TCP timeout, parse error, etc.).
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  private readonly logger = new Logger(EntitlementGuard.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    const userId: string | undefined = request.user?.id ?? request.user?.sub;
    
    // Extract contentId / videoId from path or body
    const videoId: string | undefined =
      request.params?.videoId ?? request.body?.videoId;

    if (!userId) {
      this.logger.warn('[EntitlementGuard] No userId in request — denying');
      throw new ForbiddenException('Authentication required');
    }

    try {
      // Step 1: Resolve content access tier dynamically
      let requiredTier = 0; // default to free
      if (videoId) {
        try {
          const ownership = await firstValueFrom(
            this.contentClient
              .send({ cmd: 'content.getMovieOrSeriesFromVideo' }, { videoId })
              .pipe(timeout(5000)),
          );

          let accessTier: string | undefined;
          if (ownership) {
            if (ownership.movieId) {
              const movie = await firstValueFrom(
                this.contentClient
                  .send({ cmd: 'content.getMovieById' }, { id: ownership.movieId })
                  .pipe(timeout(5000)),
              );
              accessTier = movie?.metaData?.accessTier;
            } else if (ownership.tvSeriesId) {
              const tvSeries = await firstValueFrom(
                this.contentClient
                  .send({ cmd: 'content.getTvSeriesById' }, { id: ownership.tvSeriesId })
                  .pipe(timeout(5000)),
              );
              accessTier = tvSeries?.metaData?.accessTier;
            }
          }

          if (accessTier) {
            requiredTier = PLAN_TIER[accessTier] ?? 0;
          }
        } catch (contentErr: any) {
          this.logger.error(
            `[EntitlementGuard] Failed to fetch content ${videoId}: ${contentErr.message}`,
          );
          throw new ForbiddenException(
            'Unable to verify content metadata. Access denied.',
          );
        }
      }

      // Step 2: Check Redis cache for user subscription status
      const cached = await this.redisService.get(`entitlement:${userId}`);
      if (cached) {
        const entitlement = JSON.parse(cached) as EntitlementCache;
        this.checkEntitlement(entitlement, requiredTier, userId);
        return true;
      }

      // Step 3: TCP call to order-service checkSubscription (fail-closed on timeout)
      const subscription = await firstValueFrom(
        this.orderClient
          .send({ cmd: 'order.checkSubscription' }, { userId })
          .pipe(timeout(5000)),
      );

      // Step 4: Refresh cache
      const cachePayload: EntitlementCache = {
        plan: subscription.plan ?? 'free',
        expiresAt: subscription.expiresAt ?? '',
        isActive: subscription.isActive ?? false,
      };
      await this.redisService.set(
        `entitlement:${userId}`,
        JSON.stringify(cachePayload),
        this.CACHE_TTL,
      );

      this.checkEntitlement(cachePayload, requiredTier, userId);
      return true;
    } catch (err: any) {
      // FAIL-CLOSED — deny on any check error
      if (err instanceof ForbiddenException) throw err;

      this.logger.error(
        `[EntitlementGuard] Entitlement check failed for user ${userId}: ${err.message}`,
        err.stack,
      );
      throw new ForbiddenException(
        'Unable to verify subscription. Access denied.',
      );
    }
  }

  private checkEntitlement(
    entitlement: EntitlementCache,
    requiredTier: number,
    userId: string,
  ): void {
    if (!entitlement.isActive && requiredTier > 0) {
      this.logger.warn(
        `[EntitlementGuard] User ${userId} — subscription inactive`,
      );
      throw new ForbiddenException('Active subscription required');
    }

    const userTier = PLAN_TIER[entitlement.plan] ?? 0;
    if (userTier < requiredTier) {
      this.logger.warn(
        `[EntitlementGuard] User ${userId} — plan tier ${userTier} < required ${requiredTier}`,
      );
      throw new ForbiddenException(
        'Your subscription plan does not include access to this content',
      );
    }
  }
}
