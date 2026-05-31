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
import {
  processVideoDASH,
  processVideoDASH_CPU,
  detectCuda,
} from '@app/common/utils/dash/video-dash';
import { NestFactory } from '@nestjs/core';

import { StreamingModule } from '../streaming.module';
import { ContentVideoService } from '../services/content-video.service';
import { R2StorageService } from '../services/r2.service';
import { S3Service } from '../services/s3.service';
import { DrmKeyService } from '../services/drm-key.service';
import { ShakaPackagerService } from '../services/shaka-packager.service';
import { ViolenceDetectorService } from '../services/violence-detector.service';
import { NudityDetectorService } from '../services/nudity-detector.service';

//r2
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

const resolveFfmpegExecutable = (): string => {
  // First try system ffmpeg
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('where', ['ffmpeg'], { encoding: 'utf8' });
    if (result.status === 0) {
      const path = result.stdout.trim().split('\n')[0];
      if (path && existsSync(path)) {
        console.log(`Using system FFmpeg: ${path}`);
        return path;
      }
    }
  } catch (error) {
    console.log('System FFmpeg not found via where command');
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
        console.log(`Using FFmpeg binary: ${candidate}`);
        return candidate;
      }
    }
  }

  console.warn(
    'Falling back to system "ffmpeg" executable. Set FFMPEG_PATH env variable if FFmpeg is not on PATH.',
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

console.log('Starting Video Encoding Worker...');

async function cleanupTempFiles(paths: string[]) {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) {
        const stats = await fsPromises.stat(p);
        if (stats.isDirectory()) {
          await fsPromises.rm(p, { recursive: true, force: true });
          console.log(`Cleaned up directory: ${p}`);
        } else {
          await fsPromises.unlink(p);
          console.log(`Cleaned up file: ${p}`);
        }
      }
    } catch (err) {
      console.warn(`Failed to clean up ${p}:`, err);
    }
  }
}

async function cleanupStaleFiles() {
  console.log('Scanning for stale temp files (> 24h)...');
  const uploadBaseDir = process.env.UPLOAD_DIR || 'E:/uploads';

  const dirsToScan = [
    path.join(uploadBaseDir, 'dash-temp'),
    path.join(uploadBaseDir, 'thumbnails'),
  ];

  const now = Date.now();
  const maxAgeMs = 24 * 60 * 60 * 1000;

  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = await fsPromises.readdir(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stats = await fsPromises.stat(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          if (stats.isDirectory()) {
            await fsPromises.rm(fullPath, { recursive: true, force: true });
            console.log(`Removed stale directory: ${fullPath}`);
          } else {
            await fsPromises.unlink(fullPath);
            console.log(`Removed stale file: ${fullPath}`);
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to scan directory ${dir}:`, err);
    }
  }
}

async function bootstrap() {
  console.log('Starting Video Encoding Worker...');

  // Tạo Application Context thay vì HTTP App
  const appContext =
    await NestFactory.createApplicationContext(StreamingModule);

  //Lấy instance service từ DI container
  const videoService = appContext.get(ContentVideoService);
  const s3Service = appContext.get(S3Service);
  const r2Service = appContext.get(R2StorageService);
  const drmKeyService = appContext.get(DrmKeyService);
  const shakaPackager = appContext.get(ShakaPackagerService);
  const violenceDetector = appContext.get(ViolenceDetectorService);
  const nudityDetector = appContext.get(NudityDetectorService);

  // Clean up stale files on startup
  await cleanupStaleFiles();

  //Worker chạy với DI support
  const worker = new Worker(
    'video-queue',
    async (job) => {
      const { inputPath, videoId } = job.data;
      console.log(`[Worker] Start encoding for job ${job.id}`);
      const startTime = Date.now();
      const attempts = Number(job.opts.attempts ?? 1);
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;

      const pathsToCleanup: string[] = [];

      try {
        // ────────────────────────────────────────────────────────────────────
        // STEP 1: Generate DRM encryption keys
        // ────────────────────────────────────────────────────────────────────
        console.log('Generating DRM keys...');
        const drmKey = await drmKeyService.generateKeysForVideo(videoId);
        console.log(`DRM keys ready: keyId=${drmKey.keyId.substring(0, 8)}...`);

        // ────────────────────────────────────────────────────────────────────
        // STEP 2: Transcode to fragmented MP4 (multiple bitrates + audio)
        // ────────────────────────────────────────────────────────────────────
        console.log('Processing DASH (fragmented MP4)...');
        const hasCuda = await detectCuda();
        const processor = hasCuda ? processVideoDASH : processVideoDASH_CPU;
        const dashResult = await processor(inputPath);
        pathsToCleanup.push(dashResult.outputDir);
        pathsToCleanup.push(dashResult.thumbnailPath);
        console.log(
          `DASH transcode completed: ${dashResult.videoPaths.length} variants + audio`,
        );

        // ────────────────────────────────────────────────────────────────────
        // STEP 2.5: Violence Detection (ONNX) — non-blocking
        // ────────────────────────────────────────────────────────────────────
        let violenceResult: Awaited<
          ReturnType<ViolenceDetectorService['detectViolence']>
        > | null = null;
        try {
          console.log('Running violence detection (ONNX)...');
          violenceResult = await violenceDetector.detectViolence(inputPath);
          console.log(
            `Violence detection done: isViolent=${violenceResult.isViolent}, ` +
              `segments=${violenceResult.violentSegments.length}, ` +
              `score=${violenceResult.overallScore}, ` +
              `time=${violenceResult.processingTimeMs}ms`,
          );
        } catch (violenceError) {
          console.warn(
            'Violence detection failed (non-blocking):',
            violenceError,
          );
        }

        // ────────────────────────────────────────────────────────────────────
        // STEP 2.6: Nudity Detection (ONNX) — non-blocking
        // ────────────────────────────────────────────────────────────────────
        let nudityResult: Awaited<
          ReturnType<NudityDetectorService['detectNudity']>
        > | null = null;
        try {
          console.log('Running nudity detection (ONNX)...');
          nudityResult = await nudityDetector.detectNudity(inputPath);
          console.log(
            `Nudity detection done: isNude=${nudityResult.isNude}, ` +
              `segments=${nudityResult.nuditySegments.length}, ` +
              `score=${nudityResult.overallScore}, ` +
              `time=${nudityResult.processingTimeMs}ms`,
          );
        } catch (nudityError) {
          console.warn('Nudity detection failed (non-blocking):', nudityError);
        }

        // ────────────────────────────────────────────────────────────────────
        // STEP 3: Encrypt with Shaka Packager (CENC + DASH manifest)
        // ────────────────────────────────────────────────────────────────────
        console.log('Running Shaka Packager (CENC encryption)...');

        const dashOutputDir = path.join(dashResult.outputDir, 'encrypted');
        if (!fs.existsSync(dashOutputDir)) {
          fs.mkdirSync(dashOutputDir, { recursive: true });
        }

        const mpdOutputPath = path.join(dashOutputDir, 'manifest.mpd');

        // Build input descriptors for Shaka Packager
        const shakaInputs = [
          // Video variants
          ...dashResult.videoPaths.map((videoPath, index) => ({
            filePath: videoPath,
            stream: 'video' as const,
            outputPath: path.join(
              dashOutputDir,
              `video_${['1080p', '720p', '480p'][index] || index}.mp4`,
            ),
          })),
          // Audio
          {
            filePath: dashResult.audioPath,
            stream: 'audio' as const,
            outputPath: path.join(dashOutputDir, 'audio.mp4'),
          },
        ];

        const shakaResult = await shakaPackager.packageDash({
          inputs: shakaInputs,
          keyId: drmKey.keyId,
          contentKey: drmKey.contentKey,
          mpdOutputPath,
        });

        console.log(`Shaka Packager completed: ${shakaResult.mpdPath}`);

        // ────────────────────────────────────────────────────────────────────
        // STEP 4: Upload thumbnail to R2
        // ────────────────────────────────────────────────────────────────────
        let thumbnailUrl = '';
        if (fs.existsSync(dashResult.thumbnailPath)) {
          console.log('Uploading thumbnail to R2...');
          try {
            thumbnailUrl = await r2Service.uploadImage(
              dashResult.thumbnailPath,
              `videos/${videoId}/thumbnails`,
            );
            console.log(`Uploaded thumbnail to R2: ${thumbnailUrl}`);
          } catch (error) {
            console.error('Failed to upload thumbnail to R2:', error);
            thumbnailUrl = '';
          }
        } else {
          console.warn(`Thumbnail file not found: ${dashResult.thumbnailPath}`);
        }

        // ────────────────────────────────────────────────────────────────────
        // STEP 5: Upload encrypted DASH files to S3
        // ────────────────────────────────────────────────────────────────────
        console.log('Uploading encrypted DASH files to S3...');
        const s3BaseKey = `videos/${videoId}/dash`;

        // Upload manifest.mpd
        const mpdFile = {
          path: mpdOutputPath,
          originalname: 'manifest.mpd',
          mimetype: 'application/dash+xml',
          size: fs.statSync(mpdOutputPath).size,
        } as Express.Multer.File;

        const mpdUploadResult = await s3Service.uploadLargeFile(
          mpdFile,
          `${s3BaseKey}/manifest.mpd`,
        );
        console.log(`Uploaded manifest.mpd to S3: ${mpdUploadResult.url}`);

        // Upload all encrypted output files (video segments, audio, init segments)
        const encryptedFiles = await fsPromises.readdir(dashOutputDir);
        for (const fileName of encryptedFiles) {
          if (fileName === 'manifest.mpd') continue; // Already uploaded

          const filePath = path.join(dashOutputDir, fileName);
          const fileStats = await fsPromises.stat(filePath);
          if (!fileStats.isFile()) continue;

          // Determine MIME type
          let mimetype = 'application/octet-stream';
          if (fileName.endsWith('.mp4') || fileName.endsWith('.m4s')) {
            mimetype = 'video/mp4';
          } else if (fileName.endsWith('.m4a')) {
            mimetype = 'audio/mp4';
          }

          const file = {
            path: filePath,
            originalname: fileName,
            mimetype,
            size: fileStats.size,
          } as Express.Multer.File;

          const s3Key = `${s3BaseKey}/${fileName}`;
          await s3Service.uploadLargeFile(file, s3Key);
          console.log(`Uploaded ${fileName} to S3`);
        }

        // ────────────────────────────────────────────────────────────────────
        // STEP 7: Update video entity with S3 URL + READY status
        // ────────────────────────────────────────────────────────────────────
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const updatedVideo = await videoService.updateVideo(videoId, {
          id: videoId,
          videoUrl: mpdUploadResult.url,
          status: VIDEO_STATUS.READY,
          thumbnailUrl: thumbnailUrl,
          ...(violenceResult
            ? {
                isViolent: violenceResult.isViolent,
                violenceScore: violenceResult.overallScore,
                violentSegments: violenceResult.violentSegments,
              }
            : {}),
          ...(nudityResult
            ? {
                isNude: nudityResult.isNude,
                nudityScore: nudityResult.overallScore,
                nuditySegments: nudityResult.nuditySegments,
              }
            : {}),
        } as Partial<UpdateVideoDto>);

        console.log(`Updated video ${videoId} successfully in ${duration}s`);

        // ────────────────────────────────────────────────────────────────────
        // STEP 8: Generate sprites and VTT (non-blocking)
        // ────────────────────────────────────────────────────────────────────
        console.log('Generating sprites and VTT...');
        try {
          const { spriteUrls, vttUrls } = await generateSpritesAndVTT(
            videoId,
            inputPath,
            r2Service,
          );
          console.log(
            `Generated ${spriteUrls.length} sprites and ${vttUrls.length} VTT files`,
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

          console.log(`Updated video ${videoId} with sprites and VTT`);
        } catch (error) {
          console.error('Failed to generate sprites and VTT:', error);
          // Continue, don't fail the job
        }

        // Mark input for cleanup on success
        pathsToCleanup.push(inputPath);

        console.log(
          `[Worker] Job ${job.id} completed successfully in ${duration}s`,
        );
        console.log(`Updated video entity: ${updatedVideo.id}`);
        console.log(`Video URL (DASH): ${mpdUploadResult.url}`);
        console.log(
          `DRM: CENC encrypted, keyId=${drmKey.keyId.substring(0, 8)}...`,
        );

        return {
          updatedVideo,
          duration,
          videoId,
          s3Url: mpdUploadResult.url,
          drmKeyId: drmKey.keyId,
        };
      } catch (error) {
        console.error(`[Worker] Job ${job.id} failed:`, error);

        // On final attempt, mark the input file for cleanup so it doesn't stay forever
        if (isFinalAttempt) {
          pathsToCleanup.push(inputPath);

          await videoService.updateVideo(videoId, {
            id: videoId,
            status: VIDEO_STATUS.FAILED,
            videoUrl: '',
          } as Partial<UpdateVideoDto>);
        }

        throw error;
      } finally {
        // Always execute cleanup
        console.log('Executing temp file cleanup...');
        await cleanupTempFiles(pathsToCleanup);
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
      `\n[Worker] Job ${job.id} for videoId=${job.data.videoId} completed!`,
    );
  });

  worker.on('failed', (job, err) => {
    console.error(`\n[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('\n[Worker] Worker error:', err);
  });

  console.log('Video Encoding Worker is ready and listening for jobs...');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down worker gracefully...');
    await worker.close();
    await appContext.close();
    console.log('Worker stopped');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await worker.close();
    await appContext.close();
    process.exit(0);
  });
}

bootstrap();
