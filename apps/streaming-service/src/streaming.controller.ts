import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { DrmLicenseService } from './services/drm-license.service';
import { StreamingService } from './services';
import { DrmKeyService } from './services/drm-key.service';

@Controller()
export class StreamingController {
  constructor(
    private readonly streamingService: StreamingService,
    private readonly drmLicenseService: DrmLicenseService,
    private readonly drmKeyService: DrmKeyService,
  ) {}

  @MessagePattern({ cmd: 'streaming.uploadVideo' })
  uploadVideo(@Payload() payload: { inputPath: string }) {
    return this.streamingService.uploadVideo(payload);
  }

  @MessagePattern({ cmd: 'streaming.getFileAccess' })
  getFileAccess(@Payload() payload: { s3Key: string }) {
    return this.streamingService.getFileAccess(payload.s3Key);
  }

  // ─── DRM Endpoints ────────────────────────────────────────────────────────────

  /**
   * Issue a ClearKey DRM license after validating user entitlement.
   * Called by the API Gateway when Shaka Player requests a license.
   */
  @MessagePattern({ cmd: 'streaming.drm.issueLicense' })
  issueLicense(
    @Payload() payload: { keyIds: string[]; userId: string; videoId: string },
  ) {
    return this.drmLicenseService.issueClearKeyLicense(
      payload.keyIds,
      payload.userId,
      payload.videoId,
    );
  }

  /**
   * Get the signed manifest URL for a video.
   * Returns the CloudFront signed URL to the .mpd file.
   */
  @MessagePattern({ cmd: 'streaming.getManifestUrl' })
  getManifestUrl(@Payload() payload: { videoId: string; userId?: string }) {
    return this.streamingService.getManifestUrl(payload.videoId, payload.userId);
  }

  /**
   * Get DRM key info for a video (keyId only, NOT the content key).
   * Used by the frontend to know which keyId to request a license for.
   */
  @MessagePattern({ cmd: 'streaming.drm.getKeyInfo' })
  async getDrmKeyInfo(@Payload() payload: { videoId: string }) {
    const drmKey = await this.drmKeyService.getKeyByVideoId(payload.videoId);
    if (!drmKey) {
      return null;
    }
    // Only return keyId (public), NEVER return contentKey
    return {
      videoId: drmKey.videoId,
      keyId: drmKey.keyId,
    };
  }
}
