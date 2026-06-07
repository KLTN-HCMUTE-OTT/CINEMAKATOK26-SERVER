import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { LOG_ACTION } from '@app/common/enums/log.enum';

import { AuditLogService } from './audit-log.service';
import { AuditLog } from '../entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: { create: jest.Mock; save: jest.Mock; find: jest.Mock; count: jest.Mock };
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let contentClient: { send: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 'log1', ...entity })),
      find: jest.fn(),
      count: jest.fn(),
    };
    cacheManager = { get: jest.fn(), set: jest.fn() };
    contentClient = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog, 'audit'), useValue: repository },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: 'CONTENT_SERVICE', useValue: contentClient as unknown as ClientProxy },
      ],
    }).compile();

    service = module.get(AuditLogService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('reuses an existing session id and computes signalWeight', async () => {
      cacheManager.get.mockResolvedValue('existing-session');

      await service.log({ userId: 'u1', action: LOG_ACTION.PLAY_MOVIE });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          sessionId: 'existing-session',
          signalWeight: 2, // PLAY_MOVIE weight
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('generates a new session id when none is cached', async () => {
      cacheManager.get.mockResolvedValue(null);

      await service.log({ userId: 'u2', action: LOG_ACTION.CREATE_REVIEW });

      const createdWith = repository.create.mock.calls[0][0];
      expect(createdWith.sessionId).toEqual(expect.any(String));
      expect(createdWith.signalWeight).toBe(1); // CREATE_REVIEW weight
      expect(cacheManager.set).toHaveBeenCalledWith(
        'session:u2',
        createdWith.sessionId,
        1800000,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated results and total count', async () => {
      repository.find.mockResolvedValue([{ id: 'a' }]);
      repository.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result).toEqual({ result: [{ id: 'a' }], total: 1 });
    });
  });

  describe('logVideoAction', () => {
    it('throws NotFoundException when the content service returns nothing', async () => {
      contentClient.send.mockReturnValue(of(null));

      await expect(service.logVideoAction('u1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('logs a PLAY_MOVIE action when the video maps to a movie', async () => {
      contentClient.send.mockReturnValue(of({ movieId: 'movie-1' }));
      cacheManager.get.mockResolvedValue('s1');

      await service.logVideoAction('u1', 'v1');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: LOG_ACTION.PLAY_MOVIE,
          resourceId: 'movie-1',
          userId: 'u1',
        }),
      );
    });
  });
});
