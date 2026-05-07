import { randomBytes } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EntityDrmKey } from '../entities/drm-key.entity';

/**
 * Manages CENC encryption keys for DRM-protected videos.
 *
 * Responsibilities:
 * - Generate cryptographically random Key ID + Content Encryption Key pairs
 * - Persist keys in PostgreSQL (streaming database)
 * - Look up keys by videoId (for packaging) or keyId (for license issuance)
 */
@Injectable()
export class DrmKeyService {
  private readonly logger = new Logger(DrmKeyService.name);

  constructor(
    @InjectRepository(EntityDrmKey, 'streaming')
    private readonly drmKeyRepo: Repository<EntityDrmKey>,
  ) {}

  /**
   * Generate a new CENC key pair for a video.
   *
   * - keyId:      128-bit random value (hex) — embedded in DASH manifest
   * - contentKey: 128-bit random AES key (hex) — used by Shaka Packager for encryption
   *
   * @returns The persisted DRM key entity
   */
  async generateKeysForVideo(videoId: string): Promise<EntityDrmKey> {
    // Check if keys already exist for this video
    const existing = await this.drmKeyRepo.findOne({ where: { videoId } });
    if (existing) {
      this.logger.warn(
        `DRM keys already exist for video ${videoId}, returning existing keys`,
      );
      return existing;
    }

    // Generate cryptographically random 128-bit values (16 bytes = 32 hex chars)
    const keyId = randomBytes(16).toString('hex');
    const contentKey = randomBytes(16).toString('hex');

    const drmKey = this.drmKeyRepo.create({
      videoId,
      keyId,
      contentKey,
    });

    const saved = await this.drmKeyRepo.save(drmKey);

    this.logger.log(
      `Generated DRM keys for video ${videoId}: keyId=${keyId.substring(0, 8)}...`,
    );

    return saved;
  }

  /**
   * Look up a DRM key by its public Key ID.
   * Used by the license server to issue ClearKey responses.
   */
  async getKeyByKeyId(keyId: string): Promise<EntityDrmKey | null> {
    return this.drmKeyRepo.findOne({ where: { keyId } });
  }

  /**
   * Look up a DRM key by video ID.
   * Used during packaging to retrieve keys for Shaka Packager.
   */
  async getKeyByVideoId(videoId: string): Promise<EntityDrmKey | null> {
    return this.drmKeyRepo.findOne({ where: { videoId } });
  }
}
