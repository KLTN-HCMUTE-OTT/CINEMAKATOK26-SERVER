import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { DrmKeyService } from './drm-key.service';

/**
 * Hex string → base64url encoding (required by ClearKey spec).
 * ClearKey JSON Web Key (JWK) format uses base64url for kid and k values.
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

/**
 * Handles ClearKey DRM license issuance.
 *
 * Flow:
 * 1. Player sends keyId(s) from the DASH manifest
 * 2. This service validates user entitlement (subscription check via order-service)
 * 3. If entitled, returns the Content Encryption Key in ClearKey JSON format
 * 4. Player uses EME API to decrypt video segments
 */
@Injectable()
export class DrmLicenseService {
  private readonly logger = new Logger(DrmLicenseService.name);

  constructor(
    private readonly drmKeyService: DrmKeyService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  /**
   * Issue a ClearKey license after validating user entitlement.
   *
   * @param keyIds - Array of Key IDs requested by the player (from manifest)
   * @param userId - Authenticated user's ID (from JWT)
   * @returns ClearKey JSON Web Key Set (JWKS) response
   */
  async issueClearKeyLicense(
    keyIds: string[],
    userId: string,
  ): Promise<ClearKeyLicenseResponse> {
    // Step 1: Validate user subscription via order-service
    const subscription = await this.checkUserSubscription(userId);

    if (!subscription.isActive) {
      this.logger.warn(
        `License denied for user ${userId}: subscription inactive`,
      );
      throw new ForbiddenException(
        'Active subscription required to play this content',
      );
    }

    // Step 2: Look up content encryption keys for requested keyIds
    const keys: ClearKeyLicenseResponse['keys'] = [];

    for (const keyId of keyIds) {
      const drmKey = await this.drmKeyService.getKeyByKeyId(keyId);

      if (!drmKey) {
        this.logger.warn(`Key not found for keyId: ${keyId}`);
        throw new NotFoundException(`DRM key not found for keyId: ${keyId}`);
      }

      keys.push({
        kty: 'oct',
        kid: hexToBase64url(drmKey.keyId),
        k: hexToBase64url(drmKey.contentKey),
      });
    }

    this.logger.log(
      `License issued to user ${userId} for ${keys.length} key(s)`,
    );

    // Step 3: Return ClearKey JWKS response
    return {
      keys,
      type: 'temporary',
    };
  }

  /**
   * Check user subscription status via order-service microservice.
   */
  private async checkUserSubscription(
    userId: string,
  ): Promise<{ isActive: boolean }> {
    try {
      const result = await firstValueFrom(
        this.orderClient.send(
          { cmd: 'order.checkSubscription' },
          { userId },
        ),
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to check subscription for user ${userId}: ${error.message}`,
      );
      // Fail-closed: deny access if subscription check fails
      return { isActive: false };
    }
  }
}
