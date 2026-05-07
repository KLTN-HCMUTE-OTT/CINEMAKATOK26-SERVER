import { existsSync } from 'fs';
import * as path from 'path';

import { spawn } from 'child_process';

import { Injectable, Logger } from '@nestjs/common';

export interface ShakaPackagerInput {
  filePath: string;
  stream: 'video' | 'audio';
  outputPath: string;
}

export interface ShakaPackagerOptions {
  inputs: ShakaPackagerInput[];
  keyId: string;
  contentKey: string;
  mpdOutputPath: string;
}

export interface ShakaPackagerResult {
  mpdPath: string;
  outputDir: string;
  success: boolean;
}

/**
 * Wrapper service for Google's Shaka Packager CLI.
 *
 * Shaka Packager handles:
 * - MPEG-DASH packaging (fragmented MP4 → .mpd + .m4s segments)
 * - CENC encryption (AES-128-CTR with raw key mode)
 *
 * The binary must be installed on the system. It can be downloaded from:
 * https://github.com/shaka-project/shaka-packager/releases
 *
 * Set SHAKA_PACKAGER_PATH env var to override the default location.
 */
@Injectable()
export class ShakaPackagerService {
  private readonly logger = new Logger(ShakaPackagerService.name);
  private readonly executablePath: string;

  constructor() {
    this.executablePath = this.resolveExecutable();
    this.logger.log(`Shaka Packager executable: ${this.executablePath}`);
  }

  /**
   * Package fragmented MP4 files into CENC-encrypted MPEG-DASH.
   *
   * @param options - Input files, encryption keys, and output path
   * @returns Result containing the path to the generated .mpd manifest
   */
  async packageDash(options: ShakaPackagerOptions): Promise<ShakaPackagerResult> {
    const { inputs, keyId, contentKey, mpdOutputPath } = options;

    const outputDir = path.dirname(mpdOutputPath);

    // Build Shaka Packager CLI arguments
    const args: string[] = [];

    // Add input stream descriptors
    for (const input of inputs) {
      args.push(
        `in=${input.filePath},stream=${input.stream},output=${input.outputPath}`,
      );
    }

    // Add encryption flags
    args.push(
      '--enable_raw_key_encryption',
      '--keys',
      `key_id=${keyId}:key=${contentKey}`,
      '--protection_scheme',
      'cenc',
      // Generate DASH manifest
      '--mpd_output',
      mpdOutputPath,
      // Segment duration (6 seconds, standard for DASH)
      '--segment_duration',
      '6',
    );

    this.logger.log(`Running Shaka Packager with ${inputs.length} inputs`);
    this.logger.log(`Output MPD: ${mpdOutputPath}`);
    this.logger.debug(`Command: ${this.executablePath} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const process = spawn(this.executablePath, args, {
        cwd: outputDir,
      });

      let stderrOutput = '';
      let stdoutOutput = '';

      process.stdout.on('data', (data) => {
        const msg = data.toString();
        stdoutOutput += msg;
        this.logger.debug(`[Shaka stdout] ${msg.trim()}`);
      });

      process.stderr.on('data', (data) => {
        const msg = data.toString();
        stderrOutput += msg;

        // Shaka Packager outputs progress to stderr
        if (msg.includes('Packaging completed') || msg.includes('Progress')) {
          this.logger.log(`[Shaka] ${msg.trim()}`);
        } else if (
          msg.toLowerCase().includes('error') ||
          msg.toLowerCase().includes('failed')
        ) {
          this.logger.error(`[Shaka Error] ${msg.trim()}`);
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          this.logger.log('✅ Shaka Packager completed successfully');
          resolve({
            mpdPath: mpdOutputPath,
            outputDir,
            success: true,
          });
        } else {
          this.logger.error(
            `❌ Shaka Packager failed with code ${code}`,
          );
          this.logger.error(`stderr: ${stderrOutput}`);
          reject(
            new Error(
              `Shaka Packager exited with code ${code}: ${stderrOutput}`,
            ),
          );
        }
      });

      process.on('error', (err) => {
        this.logger.error(`Failed to start Shaka Packager: ${err.message}`);
        this.logger.error(
          'Download from: https://github.com/shaka-project/shaka-packager/releases',
        );
        this.logger.error(
          'Set SHAKA_PACKAGER_PATH env var to the binary location.',
        );
        reject(
          new Error(`Shaka Packager not found: ${err.message}`),
        );
      });
    });
  }

  /**
   * Resolve the Shaka Packager binary path.
   * Checks: env var → project tools dir → system PATH
   */
  private resolveExecutable(): string {
    // 1. Environment variable
    const envPath = process.env.SHAKA_PACKAGER_PATH;
    if (envPath && existsSync(envPath)) {
      this.logger.log(`Using Shaka Packager from env: ${envPath}`);
      return envPath;
    }

    // 2. Project tools directory
    const toolsPath = path.resolve(
      process.cwd(),
      'tools',
      'shaka-packager',
      process.platform === 'win32' ? 'packager.exe' : 'packager',
    );
    if (existsSync(toolsPath)) {
      this.logger.log(`Using Shaka Packager from tools: ${toolsPath}`);
      return toolsPath;
    }

    // 3. Fall back to system PATH
    const systemName =
      process.platform === 'win32' ? 'packager.exe' : 'packager';
    this.logger.warn(
      `Shaka Packager binary not found locally. Falling back to "${systemName}" on PATH.`,
    );
    return systemName;
  }
}
