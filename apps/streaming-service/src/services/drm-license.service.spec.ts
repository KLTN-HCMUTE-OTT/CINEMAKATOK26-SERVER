import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { DrmLicenseService } from '../services/drm-license.service';
import { DrmKeyService } from '../services/drm-key.service';

describe('DrmLicenseService', () => {
  let service: DrmLicenseService;
  let drmKeyService: any;
  let orderClient: any;
  let contentClient: any;

  const mockUserId = 'user-123';
  const mockContentId = 'content-456';
  const mockKeyIds = ['key-1'];

  beforeEach(async () => {
    drmKeyService = {
      getKeyByKeyId: jest.fn(),
    };
    orderClient = {
      send: jest.fn(),
    };
    contentClient = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrmLicenseService,
        { provide: DrmKeyService, useValue: drmKeyService },
        { provide: 'ORDER_SERVICE', useValue: orderClient },
        { provide: 'CONTENT_SERVICE', useValue: contentClient },
      ],
    }).compile();

    service = module.get<DrmLicenseService>(DrmLicenseService);
  });

  it('should issue license for basic user on basic content', async () => {
    orderClient.send.mockReturnValue(of({ isActive: true, plan: 'basic' }));
    contentClient.send.mockReturnValue(of({ accessTier: 'basic' }));
    drmKeyService.getKeyByKeyId.mockResolvedValue({
      keyId: '0123456789abcdef',
      contentKey: 'fedcba9876543210',
    });

    const result = await service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId);

    expect(result.keys).toHaveLength(1);
    expect(result.keys[0].kty).toBe('oct');
    expect(orderClient.send).toHaveBeenCalledWith({ cmd: 'order.checkSubscription' }, { userId: mockUserId });
    expect(contentClient.send).toHaveBeenCalledWith({ cmd: 'content.getMovieOrSeriesFromVideo' }, { videoId: mockContentId });
  });

  it('should issue license for premium user on premium content', async () => {
    orderClient.send.mockReturnValue(of({ isActive: true, plan: 'premium' }));
    contentClient.send.mockReturnValue(of({ accessTier: 'premium' }));
    drmKeyService.getKeyByKeyId.mockResolvedValue({
      keyId: '0123456789abcdef',
      contentKey: 'fedcba9876543210',
    });

    const result = await service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId);

    expect(result.keys).toHaveLength(1);
  });

  it('should issue license for premium user on basic content', async () => {
    orderClient.send.mockReturnValue(of({ isActive: true, plan: 'premium' }));
    contentClient.send.mockReturnValue(of({ accessTier: 'basic' }));
    drmKeyService.getKeyByKeyId.mockResolvedValue({
      keyId: '0123456789abcdef',
      contentKey: 'fedcba9876543210',
    });

    const result = await service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId);

    expect(result.keys).toHaveLength(1);
  });

  it('should block basic user on premium content', async () => {
    orderClient.send.mockReturnValue(of({ isActive: true, plan: 'basic' }));
    // fetchAccessTier does: getMovieOrSeriesFromVideo → getMovieById
    // Two service calls per issueClearKeyLicense invocation (called twice below)
    contentClient.send
      .mockReturnValueOnce(of({ movieId: 'movie-1' }))
      .mockReturnValueOnce(of({ metaData: { accessTier: 'PREMIUM' } }))
      .mockReturnValueOnce(of({ movieId: 'movie-1' }))
      .mockReturnValueOnce(of({ metaData: { accessTier: 'PREMIUM' } }));

    await expect(
      service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId),
    ).rejects.toThrow(ForbiddenException);
    
    await expect(
      service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId),
    ).rejects.toThrow('Premium content requires premium subscription');
  });

  it('should block inactive subscription', async () => {
    orderClient.send.mockReturnValue(of({ isActive: false, plan: 'premium' }));
    contentClient.send.mockReturnValue(of({ accessTier: 'basic' }));

    await expect(
      service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId),
    ).rejects.toThrow(ForbiddenException);
    
    await expect(
      service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId),
    ).rejects.toThrow('No active subscription');
  });

  it('should handle order-service TCP failure (fail-closed)', async () => {
    orderClient.send.mockReturnValue(throwError(() => new Error('TCP Timeout')));
    contentClient.send.mockReturnValue(of({ accessTier: 'basic' }));

    await expect(
      service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId),
    ).rejects.toThrow(ForbiddenException);
    
    await expect(
      service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId),
    ).rejects.toThrow('No active subscription');
  });

  it('should allow access when content tier is null (fail-open)', async () => {
    orderClient.send.mockReturnValue(of({ isActive: true, plan: 'basic' }));
    contentClient.send.mockReturnValue(of({ accessTier: null }));
    drmKeyService.getKeyByKeyId.mockResolvedValue({
      keyId: '0123456789abcdef',
      contentKey: 'fedcba9876543210',
    });

    const result = await service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId);

    expect(result.keys).toHaveLength(1);
  });

  it('should throw NotFoundException if key is missing', async () => {
    orderClient.send.mockReturnValue(of({ isActive: true, plan: 'basic' }));
    contentClient.send.mockReturnValue(of({ accessTier: 'basic' }));
    drmKeyService.getKeyByKeyId.mockResolvedValue(null);

    await expect(
      service.issueClearKeyLicense(mockKeyIds, mockUserId, mockContentId),
    ).rejects.toThrow(NotFoundException);
  });
});
