import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import * as schedule from 'node-schedule';

const execAsync = promisify(exec);

type ForecastMetadata = {
  version: string;
  generatedAt: string;
  metrics?: {
    mae: number | null;
    mape: number | null;
  };
};

@Injectable()
export class ForecastTrainingScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ForecastTrainingScheduler.name);
  private scheduleJob: schedule.Job | null = null;

  private readonly forecastDir = resolve(process.cwd(), 'exports/analytics');
  private readonly currentForecastPath = resolve(
    this.forecastDir,
    'view-forecast.json',
  );
  private readonly versionedForecastDir = resolve(this.forecastDir, 'versions');
  private readonly metadataPath = resolve(
    this.forecastDir,
    'forecast-metadata.json',
  );
  private readonly MAX_VERSIONS = 3;

  onModuleInit() {
    this.scheduleTrainingJob();
  }

  onModuleDestroy() {
    if (this.scheduleJob) {
      this.scheduleJob.cancel();
      this.logger.log('Forecast training scheduler stopped');
    }
  }

  private scheduleTrainingJob() {
    /** Schedule: Every day at 2:00 AM */
    const cronExpression = '0 2 * * *';

    this.scheduleJob = schedule.scheduleJob(cronExpression, async () => {
      this.logger.log('Starting scheduled forecast training...');
      await this.executeTraining();
    });

    this.logger.log(
      `Forecast training scheduled: ${cronExpression} (2 AM daily)`,
    );
  }

  private async executeTraining() {
    const startTime = Date.now();

    try {
      /** Step 1: Run ML training script */
      this.logger.log('Running ML forecast generation...');
      const { stderr } = await execAsync('pnpm run ml:forecast:views', {
        cwd: process.cwd(),
      });

      if (stderr) {
        this.logger.warn(`ML job stderr: ${stderr}`);
      }

      /** Step 2: Validate new forecast */
      if (!existsSync(this.currentForecastPath)) {
        throw new Error('Forecast file not generated');
      }

      const newForecastRaw = readFileSync(this.currentForecastPath, 'utf-8');
      const newForecast = JSON.parse(newForecastRaw);

      if (
        !Array.isArray(newForecast.records) ||
        newForecast.records.length === 0
      ) {
        throw new Error('Invalid forecast: empty or malformed records');
      }

      const newMetrics = newForecast.metrics;
      if (!newMetrics) {
        throw new Error('Forecast missing metrics');
      }

      this.logger.log(
        `✓ New forecast validated: ${newForecast.records.length} records, MAE=${newMetrics.mae}, MAPE=${newMetrics.mape}`,
      );

      /** Step 3: Quality check (optional: compare with previous) */
      const qualityOk = await this.checkQuality(newMetrics);
      if (!qualityOk) {
        this.logger.warn(
          'New forecast quality degraded, but proceeding (override with stricter policy if needed)',
        );
      }

      /** Step 4: Versioning - save old forecast */
      this.createVersionedBackup(newMetrics);

      /** Step 5: Update metadata */
      this.updateMetadata(newMetrics);

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`✓ Training completed in ${elapsedSec}s`);
    } catch (error) {
      this.logger.error(
        `Training failed: ${error instanceof Error ? error.message : error}`,
        error,
      );
    }
  }

  private createVersionedBackup(newMetrics: any) {
    try {
      if (!existsSync(this.versionedForecastDir)) {
        require('fs').mkdirSync(this.versionedForecastDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const versionPath = resolve(
        this.versionedForecastDir,
        `view-forecast-${timestamp}.json`,
      );

      copyFileSync(this.currentForecastPath, versionPath);
      this.logger.log(`✓ Created backup: ${versionPath}`);

      /** Clean old versions */
      const versions = require('fs')
        .readdirSync(this.versionedForecastDir)
        .filter(
          (f: string) => f.startsWith('view-forecast-') && f.endsWith('.json'),
        )
        .sort()
        .reverse();

      for (let i = this.MAX_VERSIONS; i < versions.length; i += 1) {
        const oldVersion = resolve(this.versionedForecastDir, versions[i]);
        require('fs').unlinkSync(oldVersion);
        this.logger.log(`Cleaned old version: ${versions[i]}`);
      }
    } catch (error) {
      this.logger.error(
        `Backup failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private updateMetadata(newMetrics: any) {
    const metadata: ForecastMetadata = {
      version: `v${Math.floor(Date.now() / 1000)}`,
      generatedAt: new Date().toISOString(),
      metrics: newMetrics,
    };

    writeFileSync(
      this.metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8',
    );
    this.logger.log(`✓ Metadata updated: ${this.metadataPath}`);
  }

  private async checkQuality(newMetrics: any): Promise<boolean> {
    try {
      if (!existsSync(this.metadataPath)) {
        return true; /** First forecast, always accept */
      }

      const prevMetadata: ForecastMetadata = JSON.parse(
        readFileSync(this.metadataPath, 'utf-8'),
      );
      const prevMetrics = prevMetadata.metrics;

      if (!prevMetrics) {
        return true;
      }

      /** Allow 10% degradation in MAE/MAPE */
      const maxMaeDegradation = (prevMetrics.mae || 0) * 1.1;
      const maxMapeDegradation = (prevMetrics.mape || 0) * 1.1;

      const maeOk = !newMetrics.mae || newMetrics.mae <= maxMaeDegradation;
      const mapeOk = !newMetrics.mape || newMetrics.mape <= maxMapeDegradation;

      if (!maeOk || !mapeOk) {
        this.logger.warn(
          `Quality check: prev MAE=${prevMetrics.mae} vs new MAE=${newMetrics.mae}, ` +
            `prev MAPE=${prevMetrics.mape} vs new MAPE=${newMetrics.mape}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Quality check failed: ${error instanceof Error ? error.message : error}`,
      );
      return true; /** On error, proceed */
    }
  }

  /** Manual trigger endpoint (via RPC or admin API) */
  async manualRetrain(): Promise<{ success: boolean; message: string }> {
    this.logger.log('Manual retraining triggered');
    try {
      await this.executeTraining();
      return { success: true, message: 'Forecast retraining completed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    }
  }
}
