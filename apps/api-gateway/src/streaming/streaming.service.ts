import { catchRpcError } from '@app/common/exceptions';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class StreamingGatewayService {
  constructor(
    @Inject('STREAMING_SERVICE')
    private readonly streamingClient: ClientProxy,
  ) {}

  uploadVideo(payload: { inputPath: string }) {
    return this.streamingClient
      .send({ cmd: 'streaming.uploadVideo' }, payload)
      .pipe(catchRpcError());
  }

  getFileAccess(s3Key: string) {
    return this.streamingClient
      .send({ cmd: 'streaming.getFileAccess' }, { s3Key })
      .pipe(catchRpcError());
  }

  // ─── DRM ────────────────────────────────────────────────────────────────────

  /**
   * Issue a ClearKey DRM license.
   * Delegates to streaming-service which validates entitlement via order-service.
   */
  issueClearKeyLicense(
    payload: {
      keyIds: string[];
      userId: string;
      videoId: string;
    },
  ) {
    return this.streamingClient
      .send({ cmd: 'streaming.drm.issueLicense' }, payload)
      .pipe(catchRpcError());
  }

  /**
   * Get the signed manifest URL for a video.
   */
  getManifestUrl(videoId: string, userId?: string) {
    return this.streamingClient
      .send({ cmd: 'streaming.getManifestUrl' }, { videoId, userId })
      .pipe(catchRpcError());
  }

  /**
   * Get DRM key info (keyId only) for a video.
   */
  getDrmKeyInfo(videoId: string) {
    return this.streamingClient
      .send({ cmd: 'streaming.drm.getKeyInfo' }, { videoId })
      .pipe(catchRpcError());
  }
}
