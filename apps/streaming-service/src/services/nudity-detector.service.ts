import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { spawn, spawnSync } from 'child_process';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';

import type {
  CensorBox,
  CensorFrame,
  NudityDetectionResult,
} from '@app/common/types/violence.types';

// ─── Configuration ─────────────────────────────────────────────────────────────

const MODEL_PATH =
  process.env.NUDITY_MODEL_PATH || 'models/nudenet_detector.onnx';
const NUDITY_THRESHOLD = parseFloat(process.env.NUDITY_THRESHOLD || '0.4');
const FRAME_INTERVAL = parseInt(process.env.NUDITY_FRAME_INTERVAL || '2', 10);
const SCENE_THRESHOLD = parseFloat(process.env.NUDITY_SCENE_THRESHOLD || '0.3');
const NUDITY_ENABLED = process.env.NUDITY_ENABLED !== 'false';

/** Standard input size for NudeNet detector (commonly 320x320) */
const MODEL_INPUT_SIZE = parseInt(process.env.NUDITY_INPUT_SIZE || '320', 10);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedFrame {
  path: string;
  timestamp: number;
  source: 'dense' | 'scene_change';
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class NudityDetectorService implements OnModuleInit {
  private readonly logger = new Logger(NudityDetectorService.name);
  private session: ort.InferenceSession | null = null;
  private modelReady = false;

  async onModuleInit() {
    if (!NUDITY_ENABLED) {
      this.logger.warn('Nudity detection is DISABLED (NUDITY_ENABLED=false)');
      return;
    }

    await this.loadModel();
  }

  // ─── Model Loading ─────────────────────────────────────────────────────────

  private async loadModel(): Promise<void> {
    const resolvedPath = path.resolve(MODEL_PATH);

    if (!fs.existsSync(resolvedPath)) {
      this.logger.warn(
        `ONNX Nudity detector model not found at ${resolvedPath}. Nudity detection will be skipped.`,
      );
      return;
    }

    try {
      this.logger.log(
        `Loading ONNX Nudity detector model from ${resolvedPath}...`,
      );
      this.session = await ort.InferenceSession.create(resolvedPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });

      const inputNames = this.session.inputNames;
      const outputNames = this.session.outputNames;
      this.logger.log(
        `ONNX Nudity detector model loaded. Inputs: [${inputNames.join(', ')}], Outputs: [${outputNames.join(', ')}]`,
      );

      this.modelReady = true;
    } catch (error) {
      this.logger.error(
        `Failed to load ONNX Nudity detector model: ${(error as Error).message}`,
      );
      this.modelReady = false;
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Run nudity detection on a video file.
   * Non-blocking: returns empty result on failure.
   */
  async detectNudity(inputPath: string): Promise<NudityDetectionResult> {
    const startTime = Date.now();

    if (!NUDITY_ENABLED || !this.modelReady || !this.session) {
      this.logger.warn('Nudity detection unavailable, skipping.');
      return this.emptyResult(startTime);
    }

    const tmpDir = path.join(os.tmpdir(), `nudity_${Date.now()}`);

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // Step 1: Extract frames
      this.logger.log('Extracting frames for nudity detection...');
      const frames = await this.extractFrames(inputPath, tmpDir);
      this.logger.log(`Extracted ${frames.length} frames for analysis`);

      if (frames.length === 0) {
        return this.emptyResult(startTime);
      }

      // Step 2: Run object detection inference on each frame
      this.logger.log('Running ONNX object detection inference...');
      const censorFrames: CensorFrame[] = [];
      let overallScore = 0;

      for (const frame of frames) {
        try {
          const boxes = await this.inferSingleFrame(frame.path);
          if (boxes.length > 0) {
            censorFrames.push({
              timestamp: frame.timestamp,
              boxes,
            });
            const maxFrameScore = Math.max(...boxes.map((b) => b.score));
            overallScore = Math.max(overallScore, maxFrameScore);
          }
        } catch (error) {
          this.logger.warn(
            `Inference failed for frame at ${frame.timestamp}s: ${(error as Error).message}`,
          );
        }
      }

      const result: NudityDetectionResult = {
        isNude: censorFrames.length > 0,
        overallScore: Number(overallScore.toFixed(4)),
        nuditySegments: censorFrames,
        totalFramesAnalyzed: frames.length,
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.log(
        `Nudity detection done in ${result.processingTimeMs}ms: ` +
          `isNude=${result.isNude}, framesWithNudity=${censorFrames.length}, ` +
          `overallScore=${result.overallScore}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Nudity detection failed: ${(error as Error).message}`);
      return this.emptyResult(startTime);
    } finally {
      // Cleanup extracted frames
      await fsPromises
        .rm(tmpDir, { recursive: true, force: true })
        .catch(() => {});
    }
  }

  // ─── Frame Extraction ──────────────────────────────────────────────────────

  private async extractFrames(
    inputPath: string,
    tmpDir: string,
  ): Promise<ExtractedFrame[]> {
    const denseDir = path.join(tmpDir, 'dense');
    const sceneDir = path.join(tmpDir, 'scene');
    fs.mkdirSync(denseDir, { recursive: true });
    fs.mkdirSync(sceneDir, { recursive: true });

    const ffmpegPath = this.resolveFfmpeg();

    // Pass 1: Dense sampling
    await this.runFfmpeg(ffmpegPath, [
      '-i',
      inputPath,
      '-vf',
      `fps=1/${FRAME_INTERVAL},scale=${MODEL_INPUT_SIZE}:${MODEL_INPUT_SIZE}`,
      '-pix_fmt',
      'yuvj420p',
      '-q:v',
      '2',
      '-y',
      path.join(denseDir, 'frame_%05d.jpg'),
    ]);

    // Pass 2: Scene-change detection
    await this.runFfmpeg(ffmpegPath, [
      '-i',
      inputPath,
      '-vf',
      `select='gt(scene\\,${SCENE_THRESHOLD})',scale=${MODEL_INPUT_SIZE}:${MODEL_INPUT_SIZE}`,
      '-pix_fmt',
      'yuvj420p',
      '-vsync',
      'vfr',
      '-frame_pts',
      'true',
      '-q:v',
      '2',
      '-y',
      path.join(sceneDir, 'scene_%05d.jpg'),
    ]);

    // Collect dense frames
    const frames: ExtractedFrame[] = [];
    const denseFiles = await this.readSortedFiles(denseDir);
    for (let i = 0; i < denseFiles.length; i++) {
      frames.push({
        path: path.join(denseDir, denseFiles[i]),
        timestamp: i * FRAME_INTERVAL,
        source: 'dense',
      });
    }

    // Collect scene-change frames
    const sceneFiles = await this.readSortedFiles(sceneDir);
    const videoDuration = this.getVideoDuration(inputPath);

    for (let i = 0; i < sceneFiles.length; i++) {
      const approxTimestamp =
        videoDuration > 0
          ? (i / Math.max(sceneFiles.length, 1)) * videoDuration
          : i * FRAME_INTERVAL;

      frames.push({
        path: path.join(sceneDir, sceneFiles[i]),
        timestamp: Math.round(approxTimestamp),
        source: 'scene_change',
      });
    }

    // Deduplicate
    const seen = new Map<number, ExtractedFrame>();
    for (const frame of frames) {
      const roundedTs = Math.round(frame.timestamp);
      const existing = seen.get(roundedTs);
      if (
        !existing ||
        (existing.source === 'scene_change' && frame.source === 'dense')
      ) {
        seen.set(roundedTs, frame);
      }
    }

    return [...seen.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  // ─── Inference ─────────────────────────────────────────────────────────────

  private async inferSingleFrame(imagePath: string): Promise<CensorBox[]> {
    if (!this.session) {
      throw new Error('ONNX session not initialized');
    }

    // Preprocess image
    const { data, info } = await sharp(imagePath)
      .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // Default configuration for NudeNet Detector: simple [0, 1] scaling
    const normDiv = parseFloat(process.env.NUDITY_NORM_DIV || '255.0');
    const useImageNetNorm = process.env.NUDITY_IMAGENET_NORM === 'true';

    const mean = useImageNetNorm ? [0.485, 0.456, 0.406] : [0.0, 0.0, 0.0];
    const std = useImageNetNorm ? [0.229, 0.224, 0.225] : [1.0, 1.0, 1.0];

    const floatData = new Float32Array(channels * height * width);
    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const srcIdx = (h * width + w) * channels + c;
          const dstIdx = c * height * width + h * width + w;
          floatData[dstIdx] = (data[srcIdx] / normDiv - mean[c]) / std[c];
        }
      }
    }

    const inputTensor = new ort.Tensor('float32', floatData, [
      1,
      3,
      height,
      width,
    ]);
    const inputName = this.session.inputNames[0];

    const results = await this.session.run({ [inputName]: inputTensor });
    const outputName = this.session.outputNames[0];
    const outputData = results[outputName].data as Float32Array;

    const dims = results[outputName].dims;
    const numAnchors = dims[1];
    const numFeatures = dims[2];

    const boxes: CensorBox[] = [];
    const objThreshold = parseFloat(process.env.NUDITY_OBJ_THRESHOLD || '0.4');

    // Standard labels array for NudeNet Detector
    const LABELS = [
      'EXPOSED_ANUS',
      'EXPOSED_BUTTOCKS',
      'EXPOSED_BREAST_F',
      'EXPOSED_GENITALIA_F',
      'EXPOSED_BREAST_M',
      'EXPOSED_GENITALIA_M',
      'COVERED_BUTTOCKS',
      'COVERED_BREAST_F',
      'COVERED_GENITALIA_F',
      'FACE_F',
      'FACE_M',
      'BELLY',
      'ARMPITS',
      'FEET',
      'BACK',
    ];

    // Intimate parts that should be censored
    const CENSOR_LABELS = new Set([
      'EXPOSED_ANUS',
      'EXPOSED_BUTTOCKS',
      'EXPOSED_BREAST_F',
      'EXPOSED_GENITALIA_F',
      'EXPOSED_GENITALIA_M',
      'exposed_breast',
      'exposed_genitalia',
      'exposed_buttocks',
      'exposed_anus',
      'buttocks',
      'female_breast',
      'female_genitalia',
      'male_genitalia',
      'anus',
    ]);

    // Parse YOLOv5 detector outputs
    for (let i = 0; i < numAnchors; i++) {
      const offset = i * numFeatures;
      const objectness = outputData[offset + 4];

      if (objectness >= objThreshold) {
        let bestClassIdx = 0;
        let bestClassScore = 0;
        for (let c = 5; c < numFeatures; c++) {
          const score = outputData[offset + c];
          if (score > bestClassScore) {
            bestClassScore = score;
            bestClassIdx = c - 5;
          }
        }

        const confidence = objectness * bestClassScore;
        if (confidence >= NUDITY_THRESHOLD) {
          const label = LABELS[bestClassIdx] || `class_${bestClassIdx}`;

          if (
            CENSOR_LABELS.has(label) ||
            CENSOR_LABELS.has(label.toLowerCase())
          ) {
            const x_center = outputData[offset + 0];
            const y_center = outputData[offset + 1];
            const w_box = outputData[offset + 2];
            const h_box = outputData[offset + 3];

            // Convert center coordinates to top-left normalized coordinates [0.0 - 1.0]
            const x = Math.max(0, (x_center - w_box / 2) / MODEL_INPUT_SIZE);
            const y = Math.max(0, (y_center - h_box / 2) / MODEL_INPUT_SIZE);
            const w = Math.min(1 - x, w_box / MODEL_INPUT_SIZE);
            const h = Math.min(1 - y, h_box / MODEL_INPUT_SIZE);

            boxes.push({
              x: Number(x.toFixed(4)),
              y: Number(y.toFixed(4)),
              w: Number(w.toFixed(4)),
              h: Number(h.toFixed(4)),
              label,
              score: Number(confidence.toFixed(4)),
            });
          }
        }
      }
    }

    return this.applyNMS(boxes, 0.45);
  }

  // ─── Non-Maximum Suppression (NMS) ────────────────────────────────────────

  private applyNMS(boxes: CensorBox[], iouThreshold: number): CensorBox[] {
    const sorted = [...boxes].sort((a, b) => b.score - a.score);
    const selected: CensorBox[] = [];
    const active = new Array(sorted.length).fill(true);

    for (let i = 0; i < sorted.length; i++) {
      if (!active[i]) continue;
      const boxA = sorted[i];
      selected.push(boxA);

      for (let j = i + 1; j < sorted.length; j++) {
        if (!active[j]) continue;
        const boxB = sorted[j];
        const iou = this.calculateIoU(boxA, boxB);
        if (iou >= iouThreshold) {
          active[j] = false;
        }
      }
    }
    return selected;
  }

  private calculateIoU(boxA: CensorBox, boxB: CensorBox): number {
    const xA = Math.max(boxA.x, boxB.x);
    const yA = Math.max(boxA.y, boxB.y);
    const xB = Math.min(boxA.x + boxA.w, boxB.x + boxB.w);
    const yB = Math.min(boxA.y + boxA.h, boxB.y + boxB.h);

    const interWidth = Math.max(0, xB - xA);
    const interHeight = Math.max(0, yB - yA);
    const interArea = interWidth * interHeight;

    const areaA = boxA.w * boxA.h;
    const areaB = boxB.w * boxB.h;

    const unionArea = areaA + areaB - interArea;
    if (unionArea === 0) return 0;

    return interArea / unionArea;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private emptyResult(startTime: number): NudityDetectionResult {
    return {
      isNude: false,
      overallScore: 0,
      nuditySegments: [],
      totalFramesAnalyzed: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private async readSortedFiles(dir: string): Promise<string[]> {
    if (!fs.existsSync(dir)) return [];
    const files = await fsPromises.readdir(dir);
    return files.filter((f) => f.endsWith('.jpg')).sort();
  }

  private getVideoDuration(inputPath: string): number {
    const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
    const probe = spawnSync(ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);

    if (probe.status !== 0) {
      return 0;
    }

    return parseFloat(probe.stdout.toString().trim()) || 0;
  }

  private runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, { stdio: 'pipe' });
      let stderr = '';

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`),
          );
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      });
    });
  }

  private resolveFfmpeg(): string {
    try {
      const result = spawnSync(
        process.platform === 'win32' ? 'where' : 'which',
        ['ffmpeg'],
        { encoding: 'utf8' },
      );
      if (result.status === 0) {
        const resolved = result.stdout.trim().split('\n')[0];
        if (resolved && fs.existsSync(resolved)) return resolved;
      }
    } catch {
      // Ignore
    }

    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      return process.env.FFMPEG_PATH;
    }

    return 'ffmpeg';
  }
}
