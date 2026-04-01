import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as schedule from 'node-schedule';

const execAsync = promisify(exec);

type ChurnMetadata = {
  version: string;
  generatedAt: string;
  metrics?: {
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1: number | null;
    logLoss: number | null;
  };
};

@Injectable()
export class ChurnTrainingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChurnTrainingScheduler.name);
  private scheduleJob: schedule.Job | null = null;

  private readonly analyticsDir = resolve(process.cwd(), 'exports/analytics');
  private readonly currentPredictionPath = resolve(
    this.analyticsDir,
    'user-churn-prediction.json',
  );
  private readonly versionedDir = resolve(this.analyticsDir, 'versions');
  private readonly metadataPath = resolve(
    this.analyticsDir,
    'churn-metadata.json',
  );
  private readonly MAX_VERSIONS = 3;

  onModuleInit() {
    this.scheduleTrainingJob();
  }

  onModuleDestroy() {
    if (this.scheduleJob) {
      this.scheduleJob.cancel();
      this.logger.log('Churn training scheduler stopped');
    }
  }

  private scheduleTrainingJob() {
    const cronExpression = '30 2 * * *';

    this.scheduleJob = schedule.scheduleJob(cronExpression, async () => {
      this.logger.log('Starting scheduled churn model retraining...');
      await this.executeTraining();
    });

    this.logger.log(
      `Churn training scheduled: ${cronExpression} (2:30 AM daily)`,
    );
  }

  private async executeTraining() {
    const startTime = Date.now();

    try {
      this.logger.log('Running churn prediction ML job...');
      const { stderr } = await execAsync('pnpm run ml:predict:churn', {
        cwd: process.cwd(),
      });

      if (stderr) {
        this.logger.warn(`ML job stderr: ${stderr}`);
      }

      if (!existsSync(this.currentPredictionPath)) {
        throw new Error('Churn prediction file not generated');
      }

      const raw = readFileSync(this.currentPredictionPath, 'utf-8');
      const parsed = JSON.parse(raw) as {
        predictions?: unknown[];
        metrics?: ChurnMetadata['metrics'];
      };

      if (
        !Array.isArray(parsed.predictions) ||
        parsed.predictions.length === 0
      ) {
        throw new Error(
          'Invalid churn prediction: empty or malformed predictions',
        );
      }

      if (!parsed.metrics) {
        throw new Error('Churn prediction missing metrics');
      }

      this.logger.log(
        `✓ New churn prediction validated: ${parsed.predictions.length} users, F1=${parsed.metrics.f1}, logLoss=${parsed.metrics.logLoss}`,
      );

      const qualityOk = await this.checkQuality(parsed.metrics);
      if (!qualityOk) {
        this.logger.warn(
          'New churn model quality degraded, but proceeding (override with stricter policy if needed)',
        );
      }

      this.createVersionedBackup();
      this.updateMetadata(parsed.metrics);

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`✓ Churn training completed in ${elapsedSec}s`);
    } catch (error) {
      this.logger.error(
        `Churn training failed: ${error instanceof Error ? error.message : error}`,
        error,
      );
    }
  }

  private createVersionedBackup() {
    try {
      if (!existsSync(this.versionedDir)) {
        require('fs').mkdirSync(this.versionedDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const versionPath = resolve(
        this.versionedDir,
        `user-churn-prediction-${timestamp}.json`,
      );

      copyFileSync(this.currentPredictionPath, versionPath);
      this.logger.log(`✓ Created churn backup: ${versionPath}`);

      const versions = require('fs')
        .readdirSync(this.versionedDir)
        .filter(
          (f: string) =>
            f.startsWith('user-churn-prediction-') && f.endsWith('.json'),
        )
        .sort()
        .reverse();

      for (let i = this.MAX_VERSIONS; i < versions.length; i += 1) {
        const oldVersion = resolve(this.versionedDir, versions[i]);
        require('fs').unlinkSync(oldVersion);
        this.logger.log(`Cleaned old churn version: ${versions[i]}`);
      }
    } catch (error) {
      this.logger.error(
        `Churn backup failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private updateMetadata(newMetrics: ChurnMetadata['metrics']) {
    const metadata: ChurnMetadata = {
      version: `v${Math.floor(Date.now() / 1000)}`,
      generatedAt: new Date().toISOString(),
      metrics: newMetrics,
    };

    writeFileSync(
      this.metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8',
    );
    this.logger.log(`✓ Churn metadata updated: ${this.metadataPath}`);
  }

  private async checkQuality(
    newMetrics: ChurnMetadata['metrics'],
  ): Promise<boolean> {
    try {
      if (!existsSync(this.metadataPath)) {
        return true;
      }

      const prevMetadata: ChurnMetadata = JSON.parse(
        readFileSync(this.metadataPath, 'utf-8'),
      );
      const prevMetrics = prevMetadata.metrics;

      if (!prevMetrics) {
        return true;
      }

      const prevF1 = prevMetrics.f1 ?? 0;
      const newF1 = newMetrics?.f1 ?? 0;
      const prevLogLoss = prevMetrics.logLoss ?? 0;
      const newLogLoss = newMetrics?.logLoss ?? 0;

      const f1Ok = prevF1 === 0 || newF1 >= prevF1 * 0.9;
      const logLossOk = prevLogLoss === 0 || newLogLoss <= prevLogLoss * 1.1;

      if (!f1Ok || !logLossOk) {
        this.logger.warn(
          `Quality check: prev F1=${prevF1} vs new F1=${newF1}, prev logLoss=${prevLogLoss} vs new logLoss=${newLogLoss}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Quality check failed: ${error instanceof Error ? error.message : error}`,
      );
      return true;
    }
  }

  async manualRetrain(): Promise<{ success: boolean; message: string }> {
    this.logger.log('Manual churn retraining triggered');
    try {
      await this.executeTraining();
      return { success: true, message: 'Churn retraining completed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    }
  }
}
