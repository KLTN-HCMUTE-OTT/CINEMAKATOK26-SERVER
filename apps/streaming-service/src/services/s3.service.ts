import * as fs from 'fs';

import { S3Client } from '@aws-sdk/client-s3';
import { getSignedCookies } from '@aws-sdk/cloudfront-signer';
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

export interface CookiesData {
  [key: string]: {
    value: string;
    options?: object;
  };
}

const cookiesOptions = {
  domain: '.veezy.shop',
  secure: true,
  path: '/',
  sameSite: 'none',
};

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cloudfrontDomain: string;
  private readonly keyPairId: string;
  private readonly cloudfrontPrivateKey: string;

  constructor() {
    this.region = readEnv('AWS_REGION', 'aws.region', 'ap-southeast-1');
    this.bucketName = readEnv('AWS_BUCKET_NAME', 'aws.bucketName');
    const accessKeyId = readEnv('AWS_ACCESS_KEY_ID', 'aws.accessKeyId');
    const secretAccessKey = readEnv(
      'AWS_SECRET_ACCESS_KEY',
      'aws.secretAccessKey',
    );
    this.cloudfrontDomain = readEnv(
      'AWS_CLOUDFRONT_DOMAIN',
      'aws.cloudfrontDomain',
    );
    this.keyPairId = readEnv(
      'AWS_CLOUDFRONT_KEY_PAIR_ID',
      'aws.cloudfrontKeyPairId',
    );
    this.cloudfrontPrivateKey = readEnv(
      'AWS_CLOUDFRONT_PRIVATE_KEY',
      'aws.cloudfrontPrivateKey',
    );

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(
      `S3 initialized. Region=${this.region}, Bucket=${this.bucketName || 'N/A'}`,
    );

    if (!this.bucketName || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'AWS S3 configuration is incomplete. Upload/access endpoints may fail until env is configured.',
      );
    }
  }

  async uploadLargeFile(file: Express.Multer.File, key: string) {
    if (!file || !file.path) {
      throw new Error('Invalid file provided');
    }

    this.logger.log(`Uploading to S3: key=${key}, size=${file.size}`);

    try {
      const fileStream = fs.createReadStream(file.path);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileStream,
          ContentType: file.mimetype,
        },
        partSize: 10 * 1024 * 1024,
        queueSize: 5,
        leavePartsOnError: false,
      });

      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded && progress.total) {
          const percent = ((progress.loaded / progress.total) * 100).toFixed(2);
          this.logger.log(`S3 progress ${key}: ${percent}%`);
        }
      });

      const result = await upload.done();

      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      this.logger.log(`S3 upload success: ${url}`);

      return {
        key,
        bucket: this.bucketName,
        url,
        etag: result.ETag,
        location: result.Location,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      this.logger.error(`S3 upload failed for key=${key}: ${error.message}`);
      throw error;
    }
  }

  async getSignedCookiesForFile(s3FileKey: string) {
    if (
      !this.cloudfrontDomain ||
      !this.keyPairId ||
      !this.cloudfrontPrivateKey
    ) {
      throw new Error('CloudFront signer configuration is missing.');
    }

    const intervalToAddInMs = 86400 * 1000;
    const resourceUrl = `https://${this.cloudfrontDomain}/*`;

    const policy = {
      Statement: [
        {
          Resource: resourceUrl,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': Math.floor(
                (Date.now() + intervalToAddInMs) / 1000,
              ),
            },
          },
        },
      ],
    };

    const cookies = getSignedCookies({
      keyPairId: this.keyPairId,
      privateKey: this.cloudfrontPrivateKey,
      policy: JSON.stringify(policy),
    });

    const cookiesResult: CookiesData = {};
    Object.keys(cookies).forEach((key) => {
      cookiesResult[key] = {
        value: cookies[key],
        options: cookiesOptions,
      };
    });

    return {
      fileUrl: `https://${this.cloudfrontDomain}/${encodeURI(s3FileKey)}`,
      cookies: cookiesResult,
    };
  }
}
