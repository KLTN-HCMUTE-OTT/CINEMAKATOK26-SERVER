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
  ViolenceDetectionResult,
} from '@app/common/types/violence.types';

// ─── Configuration ─────────────────────────────────────────────────────────────

const MODEL_PATH =
  process.env.VIOLENCE_MODEL_PATH || 'models/violence_detector_yolo11s.onnx';
const VIOLENCE_THRESHOLD = parseFloat(process.env.VIOLENCE_THRESHOLD || '0.4');
const FRAME_INTERVAL = parseInt(process.env.VIOLENCE_FRAME_INTERVAL || '2', 10);
const SCENE_THRESHOLD = parseFloat(
  process.env.VIOLENCE_SCENE_THRESHOLD || '0.3',
);
const VIOLENCE_ENABLED = process.env.VIOLENCE_ENABLED !== 'false';

/** Standard input size for YOLO11s violence detector (640x640) */
const MODEL_INPUT_SIZE = parseInt(process.env.VIOLENCE_INPUT_SIZE || '640', 10);

/**
 * YOLO11s class labels from training metadata.
 * {0: 'NonViolence', 1: 'Violence', 2: 'guns', 3: 'knife'}
 */
const YOLO11_LABELS = ['NonViolence', 'Violence', 'guns', 'knife'];

/** Labels that should trigger censorship */
const CENSOR_LABELS = new Set(['Violence', 'guns', 'knife']);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedFrame {
  path: string;
  timestamp: number;
  source: 'dense' | 'scene_change';
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ViolenceDetectorService implements OnModuleInit {
  private readonly logger = new Logger(ViolenceDetectorService.name);
  private session: ort.InferenceSession | null = null;
  private modelReady = false;

  async onModuleInit() {
    if (!VIOLENCE_ENABLED) {
      this.logger.warn(
        'Violence detection is DISABLED (VIOLENCE_ENABLED=false)',
      );
      return;
    }

    await this.loadModel();
  }

  // ─── Model Loading ─────────────────────────────────────────────────────────

  private async loadModel(): Promise<void> {
    const resolvedPath = path.resolve(MODEL_PATH);

    if (!fs.existsSync(resolvedPath)) {
      this.logger.warn(
        `ONNX Violence detector model not found at ${resolvedPath}. Violence detection will be skipped.`,
      );
      return;
    }

    try {
      this.logger.log(
        `Loading ONNX Violence detector model from ${resolvedPath}...`,
      );
      this.session = await ort.InferenceSession.create(resolvedPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });

      const inputNames = this.session.inputNames;
      const outputNames = this.session.outputNames;
      this.logger.log(
        `ONNX Violence detector model loaded. Inputs: [${inputNames.join(', ')}], Outputs: [${outputNames.join(', ')}]`,
      );

      this.modelReady = true;
    } catch (error) {
      this.logger.error(
        `Failed to load ONNX Violence detector model: ${(error as Error).message}`,
      );
      this.modelReady = false;
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Run violence detection on a video file.
   * Non-blocking: returns empty result on failure.
   */
  async detectViolence(inputPath: string): Promise<ViolenceDetectionResult> {
    const startTime = Date.now();

    if (!VIOLENCE_ENABLED || !this.modelReady || !this.session) {
      this.logger.warn('Violence detection unavailable, skipping.');
      return this.emptyResult(startTime);
    }

    const tmpDir = path.join(os.tmpdir(), `violence_${Date.now()}`);

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // Step 1: Extract frames
      this.logger.log('Extracting frames for violence detection...');
      const frames = await this.extractFrames(inputPath, tmpDir);
      this.logger.log(`Extracted ${frames.length} frames for analysis`);

      if (frames.length === 0) {
        return this.emptyResult(startTime);
      }

      // Step 2: Run object detection inference on each frame
      this.logger.log(
        'Running ONNX object detection inference for violence...',
      );
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

      const result: ViolenceDetectionResult = {
        isViolent: censorFrames.length > 0,
        overallScore: Number(overallScore.toFixed(4)),
        violentSegments: censorFrames,
        totalFramesAnalyzed: frames.length,
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.log(
        `Violence detection done in ${result.processingTimeMs}ms: ` +
          `isViolent=${result.isViolent}, framesWithViolence=${censorFrames.length}, ` +
          `overallScore=${result.overallScore}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Violence detection failed: ${(error as Error).message}`,
      );
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

  // ─── Inference (YOLO11s) ───────────────────────────────────────────────────

  /**
   * Preprocess an image for YOLO11s: resize to MODEL_INPUT_SIZE, normalize /255,
   * and convert HWC → CHW layout.
   */
  private async preprocessImage(
    imagePath: string,
  ): Promise<{ tensor: ort.Tensor; width: number; height: number }> {
    const { data, info } = await sharp(imagePath)
      .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // YOLO11s expects simple /255.0 normalization (no ImageNet mean/std)
    const floatData = new Float32Array(channels * height * width);
    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const srcIdx = (h * width + w) * channels + c;
          const dstIdx = c * height * width + h * width + w;
          floatData[dstIdx] = data[srcIdx] / 255.0;
        }
      }
    }

    const tensor = new ort.Tensor('float32', floatData, [1, 3, height, width]);
    return { tensor, width, height };
  }

  /**
   * Run inference on a single frame using the YOLO11s model.
   *
   * YOLO11s output format: [1, numFeatures, numDetections]
   *   - numFeatures = 4 (bbox) + numClasses
   *   - For each detection column: [x_center, y_center, w, h, cls0, cls1, ...]
   *   - No separate objectness score (unlike YOLOv5)
   *   - Class scores are raw confidence values
   */
  private async inferSingleFrame(imagePath: string): Promise<CensorBox[]> {
    if (!this.session) {
      throw new Error('ONNX session not initialized');
    }

    const { tensor: inputTensor } = await this.preprocessImage(imagePath);
    const inputName = this.session.inputNames[0];

    const results = await this.session.run({ [inputName]: inputTensor });
    const outputName = this.session.outputNames[0];
    const output = results[outputName];
    const outputData = output.data as Float32Array;
    const dims = output.dims; // [1, numFeatures, numDetections]

    const boxes: CensorBox[] = [];

    // ── YOLO11s output: [1, 4+numClasses, numDetections] ──
    if (dims.length === 3) {
      const numFeatures = Number(dims[1]); // 4 + numClasses (e.g. 8 = 4 + 4)
      const numDetections = Number(dims[2]); // e.g. 8400
      const numClasses = numFeatures - 4;

      for (let d = 0; d < numDetections; d++) {
        // Find best class score for this detection
        let bestClassIdx = 0;
        let bestClassScore = -Infinity;

        for (let c = 0; c < numClasses; c++) {
          // Data layout: feature-major → index = (4 + c) * numDetections + d
          const score = outputData[(4 + c) * numDetections + d];
          if (score > bestClassScore) {
            bestClassScore = score;
            bestClassIdx = c;
          }
        }

        // Skip if confidence below threshold
        if (bestClassScore < VIOLENCE_THRESHOLD) continue;

        const label =
          YOLO11_LABELS[bestClassIdx] || `class_${bestClassIdx}`;

        // Skip non-censor labels (e.g. 'NonViolence')
        if (!CENSOR_LABELS.has(label)) continue;

        // Extract bbox: [x_center, y_center, w, h] in pixel coords
        const x_center = outputData[0 * numDetections + d];
        const y_center = outputData[1 * numDetections + d];
        const w_box = outputData[2 * numDetections + d];
        const h_box = outputData[3 * numDetections + d];

        // Convert to top-left normalized coordinates [0.0 - 1.0]
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
          score: Number(bestClassScore.toFixed(4)),
        });
      }

      return this.applyNMS(boxes, 0.45);
    }

    // ── Fallback: classification model (e.g. mobilenetv3 [1, 2]) ──
    if (dims.length === 2 && dims[1] === 2) {
      const exp0 = Math.exp(outputData[0]);
      const exp1 = Math.exp(outputData[1]);
      const sum = exp0 + exp1;
      const violentProb = exp1 / sum;

      if (violentProb >= VIOLENCE_THRESHOLD) {
        boxes.push({
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          label: 'Violence',
          score: Number(violentProb.toFixed(4)),
        });
      }
      return boxes;
    }

    this.logger.warn(
      `Unexpected output shape: [${dims.join(', ')}]. Cannot parse detections.`,
    );
    return boxes;
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

  private emptyResult(startTime: number): ViolenceDetectionResult {
    return {
      isViolent: false,
      overallScore: 0,
      violentSegments: [],
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
