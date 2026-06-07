import { Test, TestingModule } from '@nestjs/testing';

import { StreamingController } from './streaming.controller';
import { StreamingService } from './services';
import { DrmLicenseService } from './services/drm-license.service';
import { DrmKeyService } from './services/drm-key.service';

describe('StreamingController', () => {
  let controller: StreamingController;
  let streamingService: jest.Mocked<StreamingService>;
  let drmLicenseService: jest.Mocked<DrmLicenseService>;
  let drmKeyService: jest.Mocked<DrmKeyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StreamingController],
      providers: [
        {
          provide: StreamingService,
          useValue: {
            uploadVideo: jest.fn(),
            getFileAccess: jest.fn(),
            getManifestUrl: jest.fn(),
          },
        },
        {
          provide: DrmLicenseService,
          useValue: { issueClearKeyLicense: jest.fn() },
        },
        { provide: DrmKeyService, useValue: { getKeyByVideoId: jest.fn() } },
      ],
    }).compile();

    controller = module.get(StreamingController);
    streamingService = module.get(StreamingService);
    drmLicenseService = module.get(DrmLicenseService);
    drmKeyService = module.get(DrmKeyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uploadVideo forwards the payload', () => {
    const payload = { inputPath: '/tmp/in.mp4' };
    controller.uploadVideo(payload);
    expect(streamingService.uploadVideo).toHaveBeenCalledWith(payload);
  });

  it('getFileAccess unwraps the s3Key', () => {
    controller.getFileAccess({ s3Key: 'videos/v1/manifest.mpd' });
    expect(streamingService.getFileAccess).toHaveBeenCalledWith(
      'videos/v1/manifest.mpd',
    );
  });

  it('issueLicense forwards keyIds, user, video and admin flag in order', () => {
    controller.issueLicense({
      keyIds: ['k1'],
      userId: 'u1',
      videoId: 'v1',
      isAdmin: true,
    });
    expect(drmLicenseService.issueClearKeyLicense).toHaveBeenCalledWith(
      ['k1'],
      'u1',
      'v1',
      true,
    );
  });

  it('getManifestUrl forwards video and user id', () => {
    controller.getManifestUrl({ videoId: 'v1', userId: 'u1' });
    expect(streamingService.getManifestUrl).toHaveBeenCalledWith('v1', 'u1');
  });
});
