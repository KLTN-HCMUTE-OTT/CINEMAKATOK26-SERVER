import ffmpegStatic from 'ffmpeg-static';
import { existsSync, mkdirSync } from 'fs';
import { basename, join, parse } from 'path';

import { spawn } from 'child_process';

import { getConfig } from '../get-config';

/**
 * Transcode a video into multiple fragmented MP4 files for DASH packaging.
 *
 * Unlike HLS (video-hls.ts), this outputs fragmented MP4 (fMP4) files that
 * Shaka Packager consumes to produce CENC-encrypted MPEG-DASH output.
 *
 * Output structure:
 *   {outputDir}/
 *     ├── video_1080p.mp4   (fragmented, 5000k)
 *     ├── video_720p.mp4    (fragmented, 2800k)
 *     ├── video_480p.mp4    (fragmented, 1400k)
 *     └── audio.mp4         (fragmented AAC, 192k)
 */

interface DashTranscodeResult {
  outputDir: string;
  videoPaths: string[];
  audioPath: string;
  thumbnailPath: string;
}

interface VideoVariant {
  width: number;
  height: number;
  bitrate: string;
  maxrate: string;
  bufsize: string;
  outputName: string;
}

const VARIANTS: VideoVariant[] = [
  {
    width: 1920,
    height: 1080,
    bitrate: '5000k',
    maxrate: '5350k',
    bufsize: '7500k',
    outputName: 'video_1080p.mp4',
  },
  {
    width: 1280,
    height: 720,
    bitrate: '2800k',
    maxrate: '2996k',
    bufsize: '4200k',
    outputName: 'video_720p.mp4',
  },
  {
    width: 854,
    height: 480,
    bitrate: '1400k',
    maxrate: '1498k',
    bufsize: '2100k',
    outputName: 'video_480p.mp4',
  },
];

export const processVideoDASH = async (
  inputFilePath: string,
): Promise<DashTranscodeResult> => {
  console.log('🎬 Starting DASH transcode for:', inputFilePath);

  if (!existsSync(inputFilePath)) {
    throw new Error(`Input file not found: ${inputFilePath}`);
  }

  const fileName = parse(basename(inputFilePath)).name;
  const uploadBaseDir = getConfig('uploadDir', 'E:/uploads');
  const outputDir = join(uploadBaseDir, 'dash-temp', fileName);
  const thumbnailDir = join(uploadBaseDir, 'thumbnails');

  // Create output directories
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  if (!existsSync(thumbnailDir)) mkdirSync(thumbnailDir, { recursive: true });

  const ffmpegExecutable = resolveFfmpegExecutable();

  // Step 1: Transcode each video variant as fragmented MP4
  const videoPaths: string[] = [];

  for (const variant of VARIANTS) {
    const outputPath = join(outputDir, variant.outputName);
    videoPaths.push(outputPath);

    console.log(
      `📹 Transcoding ${variant.width}x${variant.height} @ ${variant.bitrate}...`,
    );

    await runFfmpeg(ffmpegExecutable, [
      '-i',
      inputFilePath,
      '-c:v',
      'h264_nvenc',
      '-b:v',
      variant.bitrate,
      '-maxrate',
      variant.maxrate,
      '-bufsize',
      variant.bufsize,
      '-vf',
      `scale=${variant.width}:${variant.height}`,
      '-preset',
      'p4',
      '-an', // No audio in video tracks
      '-movflags',
      '+frag_keyframe+empty_moov+default_base_moof',
      '-f',
      'mp4',
      outputPath,
    ]);

    console.log(`${variant.outputName} done`);
  }

  // Step 2: Extract audio as fragmented MP4
  const audioPath = join(outputDir, 'audio.mp4');
  console.log('Extracting audio...');

  await runFfmpeg(ffmpegExecutable, [
    '-i',
    inputFilePath,
    '-vn', // No video
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ac',
    '2',
    '-movflags',
    '+frag_keyframe+empty_moov+default_base_moof',
    '-f',
    'mp4',
    audioPath,
  ]);
  console.log('Audio extraction done');

  // Step 3: Generate thumbnail
  const thumbnailPath = join(thumbnailDir, `${fileName}.png`);
  console.log('Generating thumbnail...');

  try {
    await runFfmpeg(ffmpegExecutable, [
      '-i',
      inputFilePath,
      '-ss',
      '00:00:05',
      '-vframes',
      '1',
      '-vf',
      'scale=320:-1',
      thumbnailPath,
    ]);
    console.log(`Thumbnail generated: ${thumbnailPath}`);
  } catch (err) {
    console.error('Thumbnail generation failed (non-fatal):', err);
  }

  console.log(`✅ DASH transcode complete. Output: ${outputDir}`);

  return {
    outputDir,
    videoPaths,
    audioPath,
    thumbnailPath,
  };
};

/**
 * Run an FFmpeg command and return a promise.
 */
function runFfmpeg(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args);

    let stderrOutput = '';

    proc.stderr.on('data', (data) => {
      const msg = data.toString();
      stderrOutput += msg;

      if (msg.includes('frame=') || msg.includes('time=')) {
        process.stdout.write(`\r${msg.trim()}`);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`FFmpeg exited with code ${code}: ${stderrOutput}`),
        );
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg not found: ${err.message}`));
    });
  });
}

const resolveFfmpegExecutable = (): string => {
  const candidates = [
    typeof ffmpegStatic === 'string' ? ffmpegStatic : null,
    (ffmpegStatic as unknown as { path?: string })?.path,
    process.env.FFMPEG_PATH,
    process.env.ffmpeg_path,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.length > 0 && existsSync(candidate)) {
      return candidate;
    }
  }

  // Try system ffmpeg
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('where', ['ffmpeg'], { encoding: 'utf8' });
    if (result.status === 0) {
      const ffmpegPath = result.stdout.trim().split('\n')[0];
      if (ffmpegPath && existsSync(ffmpegPath)) {
        return ffmpegPath;
      }
    }
  } catch {
    // ignore
  }

  return 'ffmpeg';
};
