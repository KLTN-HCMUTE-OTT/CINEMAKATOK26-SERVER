import ffmpegStatic from 'ffmpeg-static';
import { existsSync, mkdirSync } from 'fs';
import { basename, join, parse } from 'path';
import { CreateVideoDto } from 'src/cms/dtos/video.dto';

import { spawn } from 'child_process';
import { plainToInstance } from 'class-transformer';

import { RESOLUTION, VIDEO_STATUS } from '@app/common/enums/global.enum';

import { getConfig } from '../get-config';

/**
 * Xử lý video sang HLS nhiều chất lượng (1080p, 720p, 480p)
 * Không dùng fluent-ffmpeg, dùng spawn trực tiếp => hiệu năng cao hơn
 */
export const processVideoHLS = async (inputFilePath: string): Promise<CreateVideoDto> => {
  console.log('🎬 Starting HLS processing for:', inputFilePath);

  // Verify input file exists
  if (!existsSync(inputFilePath)) {
    throw new Error(`Input file not found: ${inputFilePath}`);
  }

  const fileName = parse(basename(inputFilePath)).name;
  const uploadBaseDir = getConfig('uploadDir', 'E:/uploads');
  const videoDir = join(uploadBaseDir, 'videos', fileName);
  const thumbnailDir = join(uploadBaseDir, 'thumbnails');
  const outputDir = videoDir;

  console.log('📂 Creating output directories...');
  if (!existsSync(videoDir)) mkdirSync(videoDir, { recursive: true });
  if (!existsSync(thumbnailDir)) mkdirSync(thumbnailDir, { recursive: true });

  // Ensure variant folders exist ahead of time to prevent FFmpeg failures on Windows
  for (let i = 0; i < 3; i++) {
    const variantDir = join(outputDir, `stream_${i}`);
    if (!existsSync(variantDir)) mkdirSync(variantDir, { recursive: true });
    console.log(`   ✓ Created ${variantDir}`);
  }

  const ffmpegExecutable = resolveFfmpegExecutable();

  const ffmpegArgs = [
    '-i',
    inputFilePath,
    '-filter_complex',
    '[0:v]split=3[v1][v2][v3];' +
      '[v1]scale=w=1920:h=1080[v1out];' +
      '[v2]scale=w=1280:h=720[v2out];' +
      '[v3]scale=w=854:h=480[v3out]',

    // Video mappings
    '-map',
    '[v1out]',
    '-c:v:0',
    'h264_nvenc',
    '-b:v:0',
    '5000k',
    '-maxrate:v:0',
    '5350k',
    '-bufsize:v:0',
    '7500k',
    '-preset:v:0', // Add :v:0 to target specific stream
    'p4', // Change from 'veryfast' to 'p4' (balanced preset for NVENC)
    '-map',
    '[v2out]',
    '-c:v:1',
    'h264_nvenc',
    '-b:v:1',
    '2800k',
    '-maxrate:v:1',
    '2996k',
    '-bufsize:v:1',
    '4200k',
    '-preset:v:1', // Add :v:1
    'p4',
    '-map',
    '[v3out]',
    '-c:v:2',
    'h264_nvenc',
    '-b:v:2',
    '1400k',
    '-maxrate:v:2',
    '1498k',
    '-bufsize:v:2',
    '2100k',
    '-preset:v:2', // Add :v:2
    'p4',

    // Audio mappings
    '-map',
    'a:0',
    '-c:a:0',
    'aac',
    '-b:a:0',
    '192k',
    '-ac',
    '2',
    '-map',
    'a:0',
    '-c:a:1',
    'aac',
    '-b:a:1',
    '128k',
    '-ac',
    '2',
    '-map',
    'a:0',
    '-c:a:2',
    'aac',
    '-b:a:2',
    '96k',
    '-ac',
    '2',

    // HLS output
    '-f',
    'hls',
    '-hls_time',
    '15',
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_type',
    'mpegts',
    '-hls_segment_filename',
    `${outputDir}/stream_%v/data%03d.ts`,
    '-master_pl_name',
    'master.m3u8',
    '-var_stream_map',
    'v:0,a:0 v:1,a:1 v:2,a:2',
    '-hls_list_size',
    '0',
    '-threads',
    '0',
    // Remove global -preset flag
    `${outputDir}/stream_%v/playlist.m3u8`,
  ];

  console.log('🚀 Starting FFmpeg...');
  console.log('Command:', `${ffmpegExecutable} ${ffmpegArgs.join(' ')}`);
  console.log('Output directory:', outputDir);

  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(ffmpegExecutable, ffmpegArgs);

    let stderrOutput = '';
    let hasError = false;

    ffmpegProcess.stdout.on('data', data => {
      console.log(`[FFmpeg stdout] ${data.toString()}`);
    });

    // ffmpegProcess.stderr.on('data', data => {
    //   const msg = data.toString();
    //   stderrOutput += msg;

    //   // FFmpeg outputs progress to stderr, so we log it
    //   if (msg.includes('frame=') || msg.includes('time=')) {
    //     process.stdout.write(`\r🎞️ ${msg.trim()}`);
    //   } else if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('invalid')) {
    //     console.error(`❌ [FFmpeg Error] ${msg}`);
    //     hasError = true;
    //   } else {
    //     console.log(`[FFmpeg] ${msg.trim()}`);
    //   }
    // });

    // ffmpegProcess.on('close', async code => {
    //   console.log(`\n🏁 FFmpeg process finished with exit code: ${code}`);

    //   if (code === 0 && !hasError) {
    //     console.log(`✅ HLS transcoding complete! Output: ${outputDir}`);

    //     // Validate output files
    //     const validation = validateOutput(outputDir);
    //     if (!validation.success) {
    //       console.error('Output validation failed:');
    //       console.error(validation.message);
    //       console.error('Full FFmpeg output:');
    //       console.error(stderrOutput);
    //       reject(new Error(validation.message));
    //       return;
    //     }
    ffmpegProcess.stderr.on('data', data => {
      const msg = data.toString();
      stderrOutput += msg;

      // FFmpeg outputs progress to stderr, so we log it
      if (msg.includes('frame=') || msg.includes('time=')) {
        process.stdout.write(`\r🎞️ ${msg.trim()}`);
      } else if (
        // Only mark as error for critical failures
        (msg.toLowerCase().includes('error') &&
          !msg.includes('Error parsing Opus packet header') && // Ignore Opus warnings
          !msg.includes('deprecated pixel format')) || // Ignore deprecation warnings
        msg.toLowerCase().includes('invalid option') ||
        msg.toLowerCase().includes('no such file') ||
        msg.toLowerCase().includes('permission denied')
      ) {
        console.error(`❌ [FFmpeg Error] ${msg}`);
        hasError = true;
      } else {
        console.log(`[FFmpeg] ${msg.trim()}`);
      }
    });

    ffmpegProcess.on('close', async code => {
      console.log(`\n🏁 FFmpeg process finished with exit code: ${code}`);

      // Consider successful if exit code is 0 AND no critical errors detected
      if (code === 0 && !hasError) {
        console.log(`✅ HLS transcoding complete! Output: ${outputDir}`);

        // Validate output files
        const validation = validateOutput(outputDir);
        if (!validation.success) {
          console.error('❌ Output validation failed:');
          console.error(validation.message);
          reject(new Error(validation.message));
          return;
        }
        // === Tạo thumbnail ở thư mục riêng ===
        const thumbnailPath = join(thumbnailDir, `${fileName}.png`);
        const ffmpegThumbArgs = [
          '-i',
          inputFilePath,
          '-ss',
          '00:00:05', // lấy frame ở giây thứ 5
          '-vframes',
          '1',
          '-vf',
          'scale=320:-1',
          thumbnailPath,
        ];

        console.log('🖼️ Generating thumbnail...');
        try {
          await new Promise<void>((resolveThumb, rejectThumb) => {
            const ffmpegThumb = spawn(ffmpegExecutable, ffmpegThumbArgs);
            ffmpegThumb.on('close', thumbCode => {
              if (thumbCode === 0 && existsSync(thumbnailPath)) {
                console.log(`✅ Thumbnail generated: ${thumbnailPath}`);
                resolveThumb();
              } else {
                console.error(`❌ Thumbnail generation failed (exit code: ${thumbCode})`);
                rejectThumb(new Error('Thumbnail generation failed'));
              }
            });
            ffmpegThumb.on('error', rejectThumb);
          });
        } catch (err) {
          console.error('❌ Error generating thumbnail:', err);
        }

        const video: CreateVideoDto = {
          videoUrl: `/uploads/videos/${fileName}/master.m3u8`,
          status: VIDEO_STATUS.READY,
          thumbnailUrl: `/uploads/thumbnails/${fileName}.png`,
        };
        console.log(`✅ ${validation.message}`);
        console.log(`📁 Output files:`);
        console.log(`   - ${outputDir}/master.m3u8`);
        console.log(`   - ${outputDir}/stream_0/playlist.m3u8`);
        console.log(`   - ${outputDir}/stream_1/playlist.m3u8`);
        console.log(`   - ${outputDir}/stream_2/playlist.m3u8`);
        resolve(video);
      } else {
        console.error(`FFmpeg failed with exit code ${code}`);
        console.error('Full FFmpeg output:');
        console.error(stderrOutput);
        reject(new Error(`FFmpeg exited with code ${code}. Check logs above.`));
      }
    });

    ffmpegProcess.on('error', err => {
      console.error('❌ Failed to start FFmpeg process:', err);
      console.error('');
      console.error('💡 FFmpeg is not installed or not accessible in PATH');
      console.error('   Please install FFmpeg:');
      console.error('   • Windows: choco install ffmpeg');
      console.error('   • Or download from: https://ffmpeg.org/download.html');
      console.error('   • Then add to PATH or set FFMPEG_PATH environment variable');
      console.error('');
      console.error('   Alternative: reinstall node modules to get ffmpeg-static binary:');
      console.error('   pnpm install --force');
      reject(
        new Error(
          `FFmpeg not found: ${err.message}. See logs above for installation instructions.`,
        ),
      );
    });
  });
};

const resolveFfmpegExecutable = (): string => {
  const candidates = [
    typeof ffmpegStatic === 'string' ? ffmpegStatic : null,
    (ffmpegStatic as unknown as { path?: string })?.path,
    process.env.FFMPEG_PATH,
    process.env.ffmpeg_path,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.length > 0) {
      const exists = existsSync(candidate);
      console.log(`🔍 Checking FFmpeg binary candidate: ${candidate} (exists: ${exists})`);
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
  console.warn('   Make sure FFmpeg is installed: https://ffmpeg.org/download.html');
  return 'ffmpeg';
};

const validateOutput = (outputDir: string): { success: boolean; message: string } => {
  const masterPlaylist = join(outputDir, 'master.m3u8');

  if (!existsSync(masterPlaylist)) {
    return {
      success: false,
      message: `Master playlist not found: ${masterPlaylist}`,
    };
  }

  const errors: string[] = [];
  for (let i = 0; i < 3; i++) {
    const variantPlaylist = join(outputDir, `stream_${i}`, 'playlist.m3u8');
    if (!existsSync(variantPlaylist)) {
      errors.push(`Missing playlist for stream_${i}: ${variantPlaylist}`);
    } else {
      // Check if playlist has content
      const fs = require('fs');
      const content = fs.readFileSync(variantPlaylist, 'utf-8');
      if (content.length < 50) {
        errors.push(`Playlist for stream_${i} is too small (${content.length} bytes)`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: `Output validation failed:\n${errors.join('\n')}`,
    };
  }

  return { success: true, message: 'All output files validated successfully' };
};
