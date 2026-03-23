import * as fs from 'fs';
import * as path from 'path';

import { VIDEO_STATUS } from '@app/common/enums/global.enum';
import { Injectable } from '@nestjs/common';

import { QueueService } from './queue.service';
import { S3Service } from './s3.service';
import { ContentVideoService } from './content-video.service';

@Injectable()
export class StreamingService {
  constructor(
    private readonly queueService: QueueService,
    private readonly s3Service: S3Service,
    private readonly contentVideoService: ContentVideoService,
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
}
