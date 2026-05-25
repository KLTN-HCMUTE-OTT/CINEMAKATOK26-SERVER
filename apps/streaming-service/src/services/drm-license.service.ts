import { Injectable, Logger, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, of, from, Observable } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { DrmKeyService } from './drm-key.service';
import { ACCESS_TIER } from '@app/common/enums/global.enum';

/**
 * Hex string → base64url encoding (required by ClearKey spec).
 */
function hexToBase64url(hex: string): string {
  const bytes = Buffer.from(hex, 'hex');
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface ClearKeyLicenseResponse {
  keys: Array<{
    kty: string;
    kid: string;
    k: string;
  }>;
  type: string;
}

@Injectable()
export class DrmLicenseService {
  private readonly logger = new Logger(DrmLicenseService.name);

  constructor(
    private readonly drmKeyService: DrmKeyService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
  ) {}

  private resolveContentAccessTier(videoId: string): Observable<ACCESS_TIER> {
    return from(this.fetchAccessTier(videoId));
  }

  private async fetchAccessTier(videoId: string): Promise<ACCESS_TIER> {
    try {
      const ownership = await firstValueFrom(
        this.contentClient
          .send({ cmd: 'content.getMovieOrSeriesFromVideo' }, { videoId })
          .pipe(timeout(4000)),
      );

      let accessTier: ACCESS_TIER | undefined;
      if (ownership) {
        if (ownership.movieId) {
          const movie = await firstValueFrom(
            this.contentClient
              .send({ cmd: 'content.getMovieById' }, { id: ownership.movieId })
              .pipe(timeout(4000)),
          );
          accessTier = movie?.metaData?.accessTier as ACCESS_TIER;
        } else if (ownership.tvSeriesId) {
          const tvSeries = await firstValueFrom(
            this.contentClient
              .send({ cmd: 'content.getTvSeriesById' }, { id: ownership.tvSeriesId })
              .pipe(timeout(4000)),
          );
          accessTier = tvSeries?.metaData?.accessTier as ACCESS_TIER;
        }
      }
      return accessTier ?? ACCESS_TIER.BASIC;
    } catch (err: any) {
      this.logger.error(`[DrmLicenseService] Failed to fetch access tier for video ${videoId}: ${err.message}`);
      return ACCESS_TIER.BASIC;
    }
  }

  /**
   * Enhanced license issuance with subscription tier enforcement.
   */
  async issueClearKeyLicense(
    keyIds: string[],
    userId: string,
    videoId: string,
  ): Promise<ClearKeyLicenseResponse> {
    // Step 1: Parallel subscription + content tier check with 5s timeout
    const [sub, contentTier] = await Promise.all([
      firstValueFrom(
        this.orderClient.send({ cmd: 'order.checkSubscription' }, { userId }).pipe(
          timeout(5000),
          catchError((err) => {
            this.logger.error(`Order service TCP failure for user ${userId}: ${err.message}`);
            throw new ForbiddenException('No active subscription'); // Fail-closed
          }),
        ),
      ),
      firstValueFrom(
        this.resolveContentAccessTier(videoId).pipe(
          timeout(5000),
          catchError((err) => {
            this.logger.warn(`Content service TCP failure for video ${videoId}: ${err.message}`);
            return of(ACCESS_TIER.BASIC); // Fail-open for content tier check
          }),
        ),
      ),
    ]);

    // Step 2: Fail-closed subscription check
    if (!sub || sub.isActive === false) {
      this.logger.debug(`Subscription check failed for user ${userId}: isActive=${sub?.isActive}`);
      throw new ForbiddenException('No active subscription');
    }

    this.logger.debug(
      `Subscription check result: userId=${userId}, plan=${sub.plan}, isActive=${sub.isActive}`,
    );

    // Step 3: Content tier enforcement
    if (contentTier === ACCESS_TIER.PREMIUM && sub.plan === ACCESS_TIER.BASIC) {
      this.logger.warn(`User ${userId} (basic) attempted to access premium content for video ${videoId}`);
      throw new ForbiddenException('Premium content requires premium subscription');
    }

    if (!contentTier) {
      this.logger.warn(`Unknown access tier for video ${videoId}, defaulting to allowed (fail-open)`);
    }

    // Step 4: Issue keys
    const response = await this.buildClearKeyResponse(keyIds);

    this.logger.log(
      `DRM License issued: userId=${userId}, videoId=${videoId}, plan=${sub.plan}, keysCount=${keyIds.length}`,
    );

    return response;
  }

  /**
   * Look up keys and format ClearKey JWKS response.
   * DO NOT modify this method signature as per requirements.
   */
  async buildClearKeyResponse(keyIds: string[]): Promise<ClearKeyLicenseResponse> {
    const keys: ClearKeyLicenseResponse['keys'] = [];

    for (const keyId of keyIds) {
      const drmKey = await this.drmKeyService.getKeyByKeyId(keyId);

      if (!drmKey) {
        this.logger.error(`DRM Key not found in database: ${keyId}`);
        throw new NotFoundException(`DRM key not found for keyId: ${keyId}`);
      }

      keys.push({
        kty: 'oct',
        kid: hexToBase64url(drmKey.keyId),
        k: hexToBase64url(drmKey.contentKey),
      });
    }

    return {
      keys,
      type: 'temporary',
    };
  }

  /**
   * Non-throwing version for pre-check use (e.g. hiding premium content in listings)
   */
  async checkUserEntitlement(
    userId: string,
    videoId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      await this.issueClearKeyLicense([], userId, videoId);
      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof ForbiddenException ? error.message : 'Access denied',
      };
    }
  }
}
