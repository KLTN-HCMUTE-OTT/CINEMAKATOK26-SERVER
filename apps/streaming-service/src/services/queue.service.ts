import { Queue } from 'bullmq';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

import { VIDEO_STATUS } from '@app/common/enums/global.enum';
import { getConfig } from '@app/common/utils/get-config';
import { processVideoHLS } from '@app/common/utils/hls/video-hls';
import { Injectable, Logger } from '@nestjs/common';

import { ContentVideoService } from './content-video.service';
import { R2StorageService } from './r2.service';
import { S3Service } from './s3.service';

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
  ) {
    this.initializeQueue();
  }

  private async processSyncAndUpload(inputPath: string, videoId: string) {
    const hlsResults = await processVideoHLS(inputPath);
    const fileName = path.parse(inputPath).name;
    const uploadBaseDir = String(getConfig('uploadDir', 'uploads'));
    const hlsDirectory = path.join(uploadBaseDir, 'videos', fileName);

    let thumbnailUrl = '';
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
        thumbnailUrl = hlsResults.thumbnailUrl || '';
      }
    }

    const s3BaseKey = `videos/${videoId}/hls`;
    const masterPath = path.join(hlsDirectory, 'master.m3u8');
    const masterFile = {
      path: masterPath,
      originalname: 'master.m3u8',
      mimetype: 'application/vnd.apple.mpegurl',
      size: fs.statSync(masterPath).size,
    } as Express.Multer.File;

    const masterResult = await this.s3Service.uploadLargeFile(
      masterFile,
      `${s3BaseKey}/master.m3u8`,
    );

    const streamDirs = ['stream_0', 'stream_1', 'stream_2'];
    for (const streamDir of streamDirs) {
      const streamPath = path.join(hlsDirectory, streamDir);
      if (!fs.existsSync(streamPath)) continue;

      const files = await fsPromises.readdir(streamPath);
      for (const fileNameInDir of files) {
        const filePath = path.join(streamPath, fileNameInDir);
        const fileStats = await fsPromises.stat(filePath);
        if (!fileStats.isFile()) continue;

        const file = {
          path: filePath,
          originalname: fileNameInDir,
          mimetype: fileNameInDir.endsWith('.m3u8')
            ? 'application/vnd.apple.mpegurl'
            : 'video/MP2T',
          size: fileStats.size,
        } as Express.Multer.File;

        const s3Key = `${s3BaseKey}/${streamDir}/${fileNameInDir}`;
        await this.s3Service.uploadLargeFile(file, s3Key);
      }
    }

    await fsPromises.rm(hlsDirectory, { recursive: true, force: true });

    if (fs.existsSync(inputPath)) {
      await fsPromises.unlink(inputPath);
    }

    return this.contentVideoService.updateVideo(videoId, {
      id: videoId,
      videoUrl: masterResult.url,
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
