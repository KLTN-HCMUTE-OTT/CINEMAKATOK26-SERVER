import * as fs from 'fs';

import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';

import { StreamingService } from './streaming.service';
import { QueueService } from './queue.service';
import { S3Service } from './s3.service';
import { ContentVideoService } from './content-video.service';

jest.mock('fs');

describe('StreamingService', () => {
  let service: StreamingService;
  let s3Service: { getSignedCookiesForFile: jest.Mock };
  let contentClient: { send: jest.Mock };
  let auditClient: { send: jest.Mock };

  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(async () => {
    s3Service = { getSignedCookiesForFile: jest.fn() };
    contentClient = { send: jest.fn().mockReturnValue(of({})) };
    auditClient = { send: jest.fn().mockReturnValue(of({})) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        { provide: QueueService, useValue: { add: jest.fn() } },
        { provide: S3Service, useValue: s3Service },
        { provide: ContentVideoService, useValue: { createVideo: jest.fn() } },
        { provide: 'CONTENT_SERVICE', useValue: contentClient as unknown as ClientProxy },
        { provide: 'AUDIT_LOG_SERVICE', useValue: auditClient as unknown as ClientProxy },
      ],
    }).compile();

    service = module.get(StreamingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadVideo', () => {
    it('rejects when the input file path does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      await expect(
        service.uploadVideo({ inputPath: '/tmp/missing.mp4' }),
      ).rejects.toThrow(/input file path does not exist/);
    });
  });

  describe('getFileAccess', () => {
    it('delegates to S3Service.getSignedCookiesForFile', async () => {
      s3Service.getSignedCookiesForFile.mockResolvedValue({ fileUrl: 'signed' });

      await service.getFileAccess('videos/v1/master.m3u8');

      expect(s3Service.getSignedCookiesForFile).toHaveBeenCalledWith(
        'videos/v1/master.m3u8',
      );
    });
  });

  describe('getManifestUrl', () => {
    it('builds the dash manifest key and returns the signed url', async () => {
      s3Service.getSignedCookiesForFile.mockResolvedValue({
        fileUrl: 'https://cdn/signed.mpd',
      });

      const result = await service.getManifestUrl('v1', 'u1');

      expect(s3Service.getSignedCookiesForFile).toHaveBeenCalledWith(
        'videos/v1/dash/manifest.mpd',
      );
      expect(result).toEqual({ manifestUrl: 'https://cdn/signed.mpd' });
    });
  });
});
