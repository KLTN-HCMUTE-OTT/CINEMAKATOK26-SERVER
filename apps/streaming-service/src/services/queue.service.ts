import { Queue } from 'bullmq';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

import { VIDEO_STATUS } from '@app/common/enums/global.enum';
import { getConfig } from '@app/common/utils/get-config';
import { processVideoDASH } from '@app/common/utils/dash/video-dash';
import { Injectable, Logger } from '@nestjs/common';

import { ContentVideoService } from './content-video.service';
import { DrmKeyService } from './drm-key.service';
import { R2StorageService } from './r2.service';
import { S3Service } from './s3.service';
import { ShakaPackagerService } from './shaka-packager.service';

const readRedisEnv = (
  key: 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_PASSWORD',
  fallback: string,
) =>
  process.env[key] && String(process.env[key]).length > 0
    ? String(process.env[key])
    : fallback;

@Injectable()
export class QueueService {
  private videoQueue: Queue | null = null;
  private readonly logger = new Logger(QueueService.name);
  private isRedisAvailable = false;

  constructor(
    private readonly contentVideoService: ContentVideoService,
    private readonly s3Service: S3Service,
    private readonly r2Service: R2StorageService,
    private readonly drmKeyService: DrmKeyService,
    private readonly shakaPackager: ShakaPackagerService,
  ) {
    this.initializeQueue();
  }

  /**
   * Synchronous fallback: process video when Redis is unavailable.
   * Uses DASH + CENC pipeline (same as the async worker).
   */
  private async processSyncAndUpload(inputPath: string, videoId: string) {
    // Step 1: Generate DRM keys
    this.logger.log(`🔑 Generating DRM keys for video ${videoId}...`);
    const drmKey = await this.drmKeyService.generateKeysForVideo(videoId);
    this.logger.log(
      `✅ DRM keys ready: keyId=${drmKey.keyId.substring(0, 8)}...`,
    );

    // Step 2: Transcode to fragmented MP4
    this.logger.log(`📹 Processing DASH transcode for video ${videoId}...`);
    const dashResult = await processVideoDASH(inputPath);
    this.logger.log(
      `✅ DASH transcode completed: ${dashResult.videoPaths.length} variants`,
    );

    // Step 3: Encrypt with Shaka Packager
    this.logger.log(`🔒 Running Shaka Packager (CENC) for video ${videoId}...`);
    const dashOutputDir = path.join(dashResult.outputDir, 'encrypted');
    if (!fs.existsSync(dashOutputDir)) {
      fs.mkdirSync(dashOutputDir, { recursive: true });
    }

    const mpdOutputPath = path.join(dashOutputDir, 'manifest.mpd');

    const shakaInputs = [
      ...dashResult.videoPaths.map((videoPath, index) => ({
        filePath: videoPath,
        stream: 'video' as const,
        outputPath: path.join(
          dashOutputDir,
          `video_${['1080p', '720p', '480p'][index] || index}.mp4`,
        ),
      })),
      {
        filePath: dashResult.audioPath,
        stream: 'audio' as const,
        outputPath: path.join(dashOutputDir, 'audio.mp4'),
      },
    ];

    await this.shakaPackager.packageDash({
      inputs: shakaInputs,
      keyId: drmKey.keyId,
      contentKey: drmKey.contentKey,
      mpdOutputPath,
    });
    this.logger.log(`✅ Shaka Packager completed`);

    // Step 4: Upload thumbnail
    let thumbnailUrl = '';
    const fileName = path.parse(inputPath).name;
    const uploadBaseDir = String(getConfig('uploadDir', 'uploads'));
    const localThumbnailPath = path.join(
      uploadBaseDir,
      'thumbnails',
      `${fileName}.png`,
    );
    if (fs.existsSync(localThumbnailPath)) {
      try {
        thumbnailUrl = await this.r2Service.uploadImage(
          localThumbnailPath,
          `videos/${videoId}/thumbnails`,
        );
        await fsPromises.unlink(localThumbnailPath);
      } catch {
        thumbnailUrl = '';
      }
    }

    // Step 5: Upload encrypted DASH files to S3
    this.logger.log(`☁️  Uploading encrypted DASH files to S3...`);
    const s3BaseKey = `videos/${videoId}/dash`;

    // Upload manifest.mpd
    const mpdFile = {
      path: mpdOutputPath,
      originalname: 'manifest.mpd',
      mimetype: 'application/dash+xml',
      size: fs.statSync(mpdOutputPath).size,
    } as Express.Multer.File;

    const mpdUploadResult = await this.s3Service.uploadLargeFile(
      mpdFile,
      `${s3BaseKey}/manifest.mpd`,
    );

    // Upload all encrypted segments
    const encryptedFiles = await fsPromises.readdir(dashOutputDir);
    for (const fileNameInDir of encryptedFiles) {
      if (fileNameInDir === 'manifest.mpd') continue;

      const filePath = path.join(dashOutputDir, fileNameInDir);
      const fileStats = await fsPromises.stat(filePath);
      if (!fileStats.isFile()) continue;

      let mimetype = 'application/octet-stream';
      if (
        fileNameInDir.endsWith('.mp4') ||
        fileNameInDir.endsWith('.m4s')
      ) {
        mimetype = 'video/mp4';
      } else if (fileNameInDir.endsWith('.m4a')) {
        mimetype = 'audio/mp4';
      }

      const file = {
        path: filePath,
        originalname: fileNameInDir,
        mimetype,
        size: fileStats.size,
      } as Express.Multer.File;

      const s3Key = `${s3BaseKey}/${fileNameInDir}`;
      await this.s3Service.uploadLargeFile(file, s3Key);
    }

    // Step 6: Cleanup local files
    await fsPromises.rm(dashResult.outputDir, {
      recursive: true,
      force: true,
    });

    if (fs.existsSync(inputPath)) {
      await fsPromises.unlink(inputPath);
    }

    // Step 7: Update video entity
    return this.contentVideoService.updateVideo(videoId, {
      id: videoId,
      videoUrl: mpdUploadResult.url,
      status: VIDEO_STATUS.READY,
      thumbnailUrl,
    });
  }

  private async initializeQueue() {
    try {
      const fallbackHost = String(getConfig('redis.host', 'localhost'));
      const fallbackPort = String(getConfig('redis.port', 6379));
      const fallbackPassword = String(getConfig('redis.password', ''));

      const connection = {
        host: readRedisEnv('REDIS_HOST', fallbackHost),
        port: Number(readRedisEnv('REDIS_PORT', fallbackPort)),
        password: readRedisEnv('REDIS_PASSWORD', fallbackPassword),
        maxRetriesPerRequest: 1,
      };

      this.videoQueue = new Queue('video-queue', {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      const client = await this.videoQueue.client;
      await client.ping();
      this.isRedisAvailable = true;
      this.logger.log('Redis connection established successfully');
      this.logger.log(
        'Run worker separately: pnpm run worker:video (to process jobs independently)',
      );
    } catch (error) {
      this.isRedisAvailable = false;
      this.videoQueue = null;
      this.logger.warn(
        'Redis is not available. Videos will be processed synchronously.',
      );
    }
  }

  async addVideoJob(
    inputPath: string,
    videoId: string,
  ): Promise<{
    isQueued: boolean;
    jobId?: string;
    video?: any;
    videoId?: string;
  }> {
    if (!this.isRedisAvailable || !this.videoQueue) {
      this.logger.warn(
        'Redis unavailable, processing and uploading video synchronously...',
      );

      try {
        const updatedVideo = await this.processSyncAndUpload(
          inputPath,
          videoId,
        );

        return {
          isQueued: false,
          video: updatedVideo,
          videoId,
        };
      } catch (error) {
        await this.contentVideoService.updateVideo(videoId, {
          id: videoId,
          status: VIDEO_STATUS.FAILED,
          videoUrl: '',
        });
        throw error;
      }
    }

    const job = await this.videoQueue.add(
      'process-video',
      {
        inputPath,
        videoId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    return {
      isQueued: true,
      jobId: String(job.id),
      videoId,
    };
  }
}
