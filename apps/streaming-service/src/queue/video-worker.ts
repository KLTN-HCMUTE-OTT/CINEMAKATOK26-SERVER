import { Worker } from 'bullmq';
import ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';

import { spawn, spawnSync } from 'child_process';

import { VIDEO_STATUS } from '@app/common/enums/global.enum';
import { UpdateVideoDto } from '@app/common/dtos/content/video.dto';
import { getConfig } from '@app/common/utils/get-config';
import { processVideoHLS } from '@app/common/utils/hls/video-hls';
import { NestFactory } from '@nestjs/core';

import { StreamingModule } from '../streaming.module';
import { ContentVideoService } from '../services/content-video.service';
import { R2StorageService } from '../services/r2.service';
import { S3Service } from '../services/s3.service';

async function generateSpritesAndVTT(
  videoId: string,
  inputPath: string,
  r2Service: R2StorageService,
): Promise<{ spriteUrls: string[]; vttUrls: string[] }> {
  const ffmpegExecutable = resolveFfmpegExecutable();
  console.log('🎨 Using FFmpeg executable:', ffmpegExecutable);
  const intervalSec = 10; // 1 thumbnail mỗi 10s
  const maxThumbsPerSprite = 100;
  const thumbWidth = 320;
  const cols = 5;

  // Get duration
  const ffprobeExecutable = process.env.FFPROBE_PATH || 'ffprobe';

  const probe = spawnSync(ffprobeExecutable, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ]);
  if (probe.status !== 0) {
    throw new Error('ffprobe failed: ' + probe.stderr?.toString());
  }
  const duration = parseFloat(probe.stdout.toString().trim());
  const totalThumbs = Math.ceil(duration / intervalSec);
  const chunks = Math.ceil(totalThumbs / maxThumbsPerSprite);

  const spriteUrls: string[] = [];
  const vttUrls: string[] = [];

  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
    const startThumbIdx = chunkIndex * maxThumbsPerSprite;
    const remainingThumbs = totalThumbs - startThumbIdx;
    const thumbCount = Math.min(remainingThumbs, maxThumbsPerSprite);

    const chunkStartSec = startThumbIdx * intervalSec;
    const chunkDurationSec = thumbCount * intervalSec;

    const tmpDir = path.join(os.tmpdir(), `video_${videoId}`);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const spritePath = path.join(tmpDir, `sprite_${videoId}_${chunkIndex}.jpg`);
    const vttPath = path.join(tmpDir, `sprite_${videoId}_${chunkIndex}.vtt`);

    const rows = Math.ceil(thumbCount / cols);

    // Generate sprite using ffmpeg spawn
    const vf = `fps=1/${intervalSec},scale=${thumbWidth}:-1,tile=${cols}x${rows}`;
    const ffArgs = [
      '-ss',
      `${chunkStartSec}`,
      '-t',
      `${chunkDurationSec}`,
      '-i',
      inputPath,
      '-vf',
      vf,
      '-qscale:v',
      '2',
      '-frames:v',
      '1',
      spritePath,
    ];

    await new Promise<void>((resolve, reject) => {
      const ff = spawn(ffmpegExecutable, ffArgs);
      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg failed with code ${code}`));
      });
      ff.on('error', reject);
    });

    // Get sprite dimensions
    const meta = await sharp(spritePath).metadata();
    const spriteWidth = meta.width || 0;
    const spriteHeight = meta.height || 0;
    const thumbHeight = Math.floor(spriteHeight / Math.ceil(thumbCount / cols));

    // Upload sprite first so VTT references the final public sprite URL.
    const spriteUrl = await r2Service.uploadImage(
      spritePath,
      `videos/${videoId}/sprites`,
    );

    // Generate VTT
    const lines: string[] = ['WEBVTT\n'];
    for (let i = 0; i < thumbCount; i++) {
      const globalThumbIndex = startThumbIdx + i;
      const startTime = globalThumbIndex * intervalSec;
      const endTime = Math.min((globalThumbIndex + 1) * intervalSec, duration);
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = col * (spriteWidth / cols);
      const y = row * thumbHeight;

      lines.push(`${formatSeconds(startTime)} --> ${formatSeconds(endTime)}`);
      lines.push(
        `${spriteUrl}#xywh=${Math.floor(x)},${Math.floor(y)},${Math.floor(spriteWidth / cols)},${thumbHeight}\n`,
      );
    }
    fs.writeFileSync(vttPath, lines.join('\n'));

    // Upload VTT to R2
    const vttUrl = await r2Service.uploadFile(
      vttPath,
      `videos/${videoId}/sprites`,
      'text/vtt',
    );

    spriteUrls.push(spriteUrl);
    vttUrls.push(vttUrl);

    // Cleanup
    await fsPromises.unlink(spritePath);
    await fsPromises.unlink(vttPath);
  }
  return { spriteUrls, vttUrls };
}

function formatSeconds(s: number): string {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}.${String(ms).padStart(3, '0')}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function resolveLocalOutputPaths(inputPath: string): {
  fileName: string;
  uploadBaseDir: string;
  hlsDirectory: string;
  masterPath: string;
  thumbnailPath: string;
} {
  const fileName = path.parse(inputPath).name;
  const configuredUploadDir = String(getConfig('uploadDir', 'uploads'));
  const uploadBaseDir = path.isAbsolute(configuredUploadDir)
    ? configuredUploadDir
    : path.resolve(process.cwd(), configuredUploadDir);

  const hlsDirectory = path.join(uploadBaseDir, 'videos', fileName);
  const masterPath = path.join(hlsDirectory, 'master.m3u8');
  const thumbnailPath = path.join(
    uploadBaseDir,
    'thumbnails',
    `${fileName}.png`,
  );

  return {
    fileName,
    uploadBaseDir,
    hlsDirectory,
    masterPath,
    thumbnailPath,
  };
}

const resolveFfmpegExecutable = (): string => {
  // First try system ffmpeg
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('where', ['ffmpeg'], { encoding: 'utf8' });
    if (result.status === 0) {
      const path = result.stdout.trim().split('\n')[0];
      if (path && existsSync(path)) {
        console.log(`✅ Using system FFmpeg: ${path}`);
        return path;
      }
    }
  } catch (error) {
    console.log('⚠️  System FFmpeg not found via where command');
  }

  // Then try static binaries
  const candidates = [
    typeof ffmpegStatic === 'string' ? ffmpegStatic : null,
    (ffmpegStatic as unknown as { path?: string })?.path,
    process.env.FFMPEG_PATH,
    process.env.ffmpeg_path,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.length > 0) {
      const exists = existsSync(candidate);
      console.log(
        `🔍 Checking FFmpeg binary candidate: ${candidate} (exists: ${exists})`,
      );
      if (exists) {
        console.log(`✅ Using FFmpeg binary: ${candidate}`);
        return candidate;
      }
    }
  }

  console.warn(
    '⚠️  Falling back to system "ffmpeg" executable. Set FFMPEG_PATH env variable if FFmpeg is not on PATH.',
  );
  console.warn('   ffmpeg-static returned:', ffmpegStatic);
  console.warn(
    '   Make sure FFmpeg is installed: https://ffmpeg.org/download.html',
  );
  return 'ffmpeg';
};

export const connection = {
  host: process.env.REDIS_HOST || String(getConfig('redis.host', 'localhost')),
  port: parseInt(
    process.env.REDIS_PORT || String(getConfig('redis.port', '6379')),
    10,
  ),
  password:
    process.env.REDIS_PASSWORD || String(getConfig('redis.password', '')),
};

console.log('🚀 Starting Video Encoding Worker...');
console.log('📡 Redis connection:', connection);

async function bootstrap() {
  console.log('🚀 Starting Video Encoding Worker...');
  console.log('📡 Redis connection:', connection);

  // ✅ Tạo Application Context thay vì HTTP App
  const appContext =
    await NestFactory.createApplicationContext(StreamingModule);

  // ✅ Lấy instance service từ DI container
  const videoService = appContext.get(ContentVideoService);
  const s3Service = appContext.get(S3Service);
  const r2Service = appContext.get(R2StorageService);

  // ✅ Worker chạy với DI support
  const worker = new Worker(
    'video-queue',
    async (job) => {
      const { inputPath, videoId } = job.data;
      console.log(`🎬 [Worker] Start encoding for job ${job.id}`);
      const startTime = Date.now();
      const attempts = Number(job.opts.attempts ?? 1);
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;

      try {
        // Xử lý HLS
        console.log('📹 Processing HLS...');
        const hlsResult = await processVideoHLS(inputPath);
        console.log(`✅ HLS processing completed: ${hlsResult.videoUrl}`);

        const { hlsDirectory, masterPath, thumbnailPath } =
          resolveLocalOutputPaths(inputPath);

        // Upload thumbnail FIRST (before HLS files)
        let thumbnailUrl = '';
        if (fs.existsSync(thumbnailPath)) {
          console.log('📸 Uploading thumbnail to R2...');
          console.log(`   Source: ${thumbnailPath}`);

          try {
            // ✅ FIX: Ensure R2 bucket name is valid
            // Check your R2Service configuration for bucket name
            thumbnailUrl = await r2Service.uploadImage(
              thumbnailPath,
              `videos/${videoId}/thumbnails`,
            );
            console.log(`✅ Uploaded thumbnail to R2: ${thumbnailUrl}`);

            // Clean up local thumbnail after successful upload
            await fsPromises.unlink(thumbnailPath);
            console.log(`🗑️  Deleted local thumbnail: ${thumbnailPath}`);
          } catch (error) {
            console.error('❌ Failed to upload thumbnail to R2:', error);
            console.error('   Error details:', error.message);
            // Keep configured thumbnail URL as fallback
            thumbnailUrl = hlsResult.thumbnailUrl ?? '';
          }
        } else {
          console.warn(`⚠️  Thumbnail file not found: ${thumbnailPath}`);
        }

        // Upload HLS files to S3
        console.log('☁️  Uploading HLS files to S3...');
        const s3BaseKey = `videos/${videoId}/hls`;

        if (!fs.existsSync(masterPath)) {
          throw new Error(`HLS master file not found: ${masterPath}`);
        }

        // Upload master.m3u8
        const masterFile = {
          path: masterPath,
          originalname: 'master.m3u8',
          mimetype: 'application/vnd.apple.mpegurl',
          size: fs.statSync(masterPath).size,
        } as Express.Multer.File;

        const masterResult = await s3Service.uploadLargeFile(
          masterFile,
          `${s3BaseKey}/master.m3u8`,
        );
        console.log(`✅ Uploaded master.m3u8 to S3: ${masterResult.url}`);

        // Upload tất cả thư mục stream_0, stream_1, stream_2
        const directoryEntries = await fsPromises.readdir(hlsDirectory, {
          withFileTypes: true,
        });
        const streamDirs = directoryEntries
          .filter(
            (entry) => entry.isDirectory() && entry.name.startsWith('stream_'),
          )
          .map((entry) => entry.name);

        for (const streamDir of streamDirs) {
          const streamPath = path.join(hlsDirectory, streamDir);

          if (!fs.existsSync(streamPath)) {
            console.warn(`⚠️  Directory not found: ${streamPath}`);
            continue;
          }

          console.log(`📂 Uploading ${streamDir}...`);

          // Đọc tất cả file trong thư mục stream_X
          const files = await fsPromises.readdir(streamPath);

          for (const fileName of files) {
            const filePath = path.join(streamPath, fileName);
            const fileStats = await fsPromises.stat(filePath);

            // Bỏ qua nếu là thư mục
            if (!fileStats.isFile()) continue;

            const file = {
              path: filePath,
              originalname: fileName,
              mimetype: fileName.endsWith('.m3u8')
                ? 'application/vnd.apple.mpegurl'
                : 'video/MP2T',
              size: fileStats.size,
            } as Express.Multer.File;

            // Upload với đường dẫn đúng: videos/{videoId}/hls/stream_0/data000.ts
            const s3Key = `${s3BaseKey}/${streamDir}/${fileName}`;
            await s3Service.uploadLargeFile(file, s3Key);
            console.log(`✅ Uploaded ${streamDir}/${fileName} to S3`);
          }
        }

        // 4Cleanup - ONLY after all uploads succeed
        console.log('🗑️  Cleaning up local files...');

        // Delete HLS directory
        await fsPromises.rm(hlsDirectory, { recursive: true, force: true });
        console.log('✅ Local HLS files deleted');

        // Update video entity
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const updatedVideo = await videoService.updateVideo(videoId, {
          id: videoId,
          videoUrl: masterResult.url,
          status: VIDEO_STATUS.READY,
          thumbnailUrl: thumbnailUrl,
        } as Partial<UpdateVideoDto>);

        console.log(`✅ Updated video ${videoId} successfully in ${duration}s`);

        // Generate sprites and VTT
        console.log('🎨 Generating sprites and VTT...');
        try {
          const { spriteUrls, vttUrls } = await generateSpritesAndVTT(
            videoId,
            inputPath,
            r2Service,
          );
          console.log(
            `✅ Generated ${spriteUrls.length} sprites and ${vttUrls.length} VTT files`,
          );

          // Update video entity with sprites and VTT
          console.log('About to update video with sprites and VTT:', {
            sprites: spriteUrls,
            vttFiles: vttUrls,
          });
          const updatedVideoWithSprites = await videoService.updateVideo(
            videoId,
            {
              id: videoId,
              sprites: spriteUrls,
              vttFiles: vttUrls,
            } as Partial<UpdateVideoDto>,
          );
          console.log('Updated video entity with sprites and VTT:', {
            id: updatedVideoWithSprites.id,
            sprites: updatedVideoWithSprites.sprites,
            vttFiles: updatedVideoWithSprites.vttFiles,
          });

          console.log(`✅ Updated video ${videoId} with sprites and VTT`);
        } catch (error) {
          console.error('❌ Failed to generate sprites and VTT:', error);
          // Continue, don't fail the job
        }

        // Cleanup original uploaded input to avoid disk growth on worker host.
        if (fs.existsSync(inputPath)) {
          await fsPromises.unlink(inputPath);
          console.log(`🗑️  Deleted original uploaded file: ${inputPath}`);
        }

        console.log(
          `✅ [Worker] Job ${job.id} completed successfully in ${duration}s`,
        );
        console.log(`   Updated video entity: ${updatedVideo.id}`);
        console.log(`   Video URL: ${masterResult.url}`);

        return {
          updatedVideo,
          duration,
          videoId,
          s3Url: masterResult.url,
        };
      } catch (error) {
        console.error(`❌ [Worker] Job ${job.id} failed:`, error);

        if (isFinalAttempt && fs.existsSync(inputPath)) {
          await fsPromises.unlink(inputPath);
          console.log(
            `🗑️  Deleted failed input file (final attempt): ${inputPath}`,
          );
        }

        // Mark FAILED only on final attempt to allow retry to continue processing.
        if (isFinalAttempt) {
          await videoService.updateVideo(videoId, {
            id: videoId,
            status: VIDEO_STATUS.FAILED,
            videoUrl: '',
          } as Partial<UpdateVideoDto>);
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: 4,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  );

  // Logging các event
  worker.on('completed', (job) => {
    console.log(
      `\n✅ [Worker] Job ${job.id} for videoId=${job.data.videoId} completed!`,
    );
  });

  worker.on('failed', (job, err) => {
    console.error(`\n❌ [Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('\n💥 [Worker] Worker error:', err);
  });

  console.log('✅ Video Encoding Worker is ready and listening for jobs...');
  console.log('📝 Press Ctrl+C to stop\n');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down worker gracefully...');
    await worker.close();
    await appContext.close(); // ✅ đóng Nest context
    console.log('👋 Worker stopped');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n⏹️  Received SIGTERM, shutting down...');
    await worker.close();
    await appContext.close();
    process.exit(0);
  });
}

bootstrap();
