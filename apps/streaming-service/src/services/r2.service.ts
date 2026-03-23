import * as fs from 'fs';
import * as path from 'path';

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getConfig } from '@app/common/utils/get-config';
import { Injectable, Logger } from '@nestjs/common';

const readEnv = (envKey: string, configKey: string, fallback = ''): string => {
  const envValue = process.env[envKey];
  if (typeof envValue === 'string' && envValue.length > 0) {
    return envValue;
  }
  return String(getConfig(configKey, fallback));
};

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor() {
    const accessKeyId = readEnv('R2_ACCESS_KEY_ID', 'r2.accessKeyId');
    const secretAccessKey = readEnv(
      'R2_SECRET_ACCESS_KEY',
      'r2.secretAccessKey',
    );
    const endpoint = readEnv('R2_ENDPOINT', 'r2.endpoint');

    this.bucketName = readEnv('R2_BUCKET_NAME', 'r2.bucketNameR2');
    this.publicUrl = readEnv('R2_PUBLIC_URL', 'r2.publicUrl');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(
      `R2 initialized. Endpoint=${endpoint || 'N/A'}, Bucket=${this.bucketName || 'N/A'}`,
    );

    if (!this.bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'R2 configuration is incomplete. Sprite/thumbnail upload may fail until env is configured.',
      );
    }
  }

  async uploadImage(filePath: string, folder = 'thumbnails'): Promise<string> {
    const fileName = `${folder}/${Date.now()}-${path.basename(filePath)}`;
    const fileBuffer = fs.readFileSync(filePath);

    this.logger.log(`Uploading image to R2: ${fileName}`);

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: fileName,
          Body: fileBuffer,
          ContentType: 'image/png',
        },
      });

      await upload.done();
      const url = `${this.publicUrl}/${fileName}`;
      this.logger.log(`R2 image upload success: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`R2 image upload failed: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(
    filePath: string,
    folder = 'files',
    contentType = 'application/octet-stream',
  ): Promise<string> {
    const fileName = `${folder}/${Date.now()}-${path.basename(filePath)}`;
    const fileBuffer = fs.readFileSync(filePath);

    this.logger.log(`Uploading file to R2: ${fileName}`);

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: fileName,
          Body: fileBuffer,
          ContentType: contentType,
        },
      });

      await upload.done();
      const url = `${this.publicUrl}/${fileName}`;
      this.logger.log(`R2 file upload success: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`R2 file upload failed: ${error.message}`);
      throw error;
    }
  }
}
