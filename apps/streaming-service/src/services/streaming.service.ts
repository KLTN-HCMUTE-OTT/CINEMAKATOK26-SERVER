import * as fs from 'fs';
import * as path from 'path';

import { VIDEO_STATUS } from '@app/common/enums/global.enum';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { QueueService } from './queue.service';
import { S3Service } from './s3.service';
import { ContentVideoService } from './content-video.service';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly s3Service: S3Service,
    private readonly contentVideoService: ContentVideoService,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    @Inject('AUDIT_LOG_SERVICE')
    private readonly auditClient: ClientProxy,  
  ) {}

  async uploadVideo(payload: { inputPath: string }) {
    const { inputPath } = payload;

    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new Error(
        'Invalid upload payload: input file path does not exist.',
      );
    }

    const fileName = path.parse(inputPath).name;

    const createdVideo = await this.contentVideoService.createVideo({
      videoUrl: `/uploads/${fileName}/master.m3u8`,
      status: VIDEO_STATUS.PROCESSING,
      thumbnailUrl: `/uploads/${fileName}/thumbnail.jpg`,
    });

    const result = await this.queueService.addVideoJob(
      inputPath,
      createdVideo.id,
    );

    if (!result.isQueued && result.video) {
      return {
        video: result.video,
        videoId: result.videoId ?? null,
        queued: false,
      };
    }

    return {
      video: createdVideo,
      jobId: result.jobId ?? null,
      queued: true,
    };
  }

  async getFileAccess(s3Key: string) {
    return this.s3Service.getSignedCookiesForFile(s3Key);
  }

  /**
   * Generate a signed CloudFront URL for the DASH manifest (.mpd).
   * The signed URL is short-lived (1 hour) for security.
   */
  async getManifestUrl(videoId: string, userId?: string): Promise<{ manifestUrl: string }> {
    const s3Key = `videos/${videoId}/dash/manifest.mpd`;

    this.logger.log(`Generating signed manifest URL for video ${videoId}`);

    const result = await this.s3Service.getSignedCookiesForFile(s3Key);
    // Increment views and log play action in the background
    this.handleVideoWatchActions(videoId, userId).catch((err) => {
      this.logger.error(`Error handling video watch actions for video ${videoId}: ${err.message}`);
    });

    return {
      manifestUrl: result.fileUrl,
    };
  }

  private async handleVideoWatchActions(videoId: string, userId?: string) {
    try {
      // 1. Resolve content ID from video ID
      const videoResult = await firstValueFrom(
        this.contentClient.send<{
          movieId?: string;
          tvSeriesId?: string;
          episodeId?: string;
        }>({ cmd: 'content.getMovieOrSeriesFromVideo' }, { videoId }),
      ).catch(() => null);
      if (videoResult) {
        let contentId: string | undefined;
        if (videoResult.movieId) {
          const movie = await firstValueFrom(
            this.contentClient.send({ cmd: 'content.getMovieById' }, { id: videoResult.movieId })
          ).catch(() => null);
          contentId = movie?.metaData?.id;
        } else if (videoResult.tvSeriesId) {
          const tvSeries = await firstValueFrom(
            this.contentClient.send({ cmd: 'content.getTvSeriesById' }, { id: videoResult.tvSeriesId })
          ).catch(() => null);
          contentId = tvSeries?.metaData?.id;
        }
        // 2. Increase view count of the content
        if (contentId) {
          await firstValueFrom(
            this.contentClient.send({ cmd: 'content.increaseViewCount' }, { id: contentId })
          ).catch((err) => {
            this.logger.warn(`Failed to increase view count for content ${contentId}: ${err.message}`);
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve content and increase view count: ${err.message}`);
    }
    // 3. Log the play video action in audit-log-service if userId is provided
    if (userId) {
      try {
        await firstValueFrom(
          this.auditClient.send({ cmd: 'create_video_log' }, { userId, videoId })
        ).catch((err) => {
          this.logger.warn(`Failed to emit watch audit log: ${err.message}`);
        });
      } catch (err) {
        this.logger.warn(`Failed to connect/send to AUDIT_LOG_SERVICE: ${err.message}`);
      }
    }
  }
}
