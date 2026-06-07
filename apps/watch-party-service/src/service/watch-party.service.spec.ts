import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { WatchPartyError } from '@app/common/exceptions';

import { WatchPartyService } from './watch-party.service';
import { WATCH_PARTY_REDIS } from '../watch-party.constants';

describe('WatchPartyService', () => {
  let service: WatchPartyService;
  let redis: Record<string, jest.Mock>;

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      hgetall: jest.fn(),
      hget: jest.fn(),
      scard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchPartyService,
        { provide: WATCH_PARTY_REDIS, useValue: redis },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, def?: unknown) => def },
        },
      ],
    }).compile();

    service = module.get(WatchPartyService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRoomIdForUser', () => {
    it('returns the room id stored for the user', async () => {
      redis.get.mockResolvedValue('room-1');
      await expect(service.getRoomIdForUser('u1')).resolves.toBe('room-1');
    });
  });

  describe('lookupInvite', () => {
    it('throws NOT_FOUND when the invite code maps to nothing', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.lookupInvite('BADCODE')).rejects.toBeInstanceOf(
        WatchPartyError,
      );
    });

    it('cleans up and throws when the room behind the invite has expired', async () => {
      redis.get.mockResolvedValue('room-1');
      redis.hgetall.mockResolvedValue({}); // no roomId => expired

      await expect(service.lookupInvite('CODE')).rejects.toBeInstanceOf(
        WatchPartyError,
      );
      expect(redis.del).toHaveBeenCalled();
    });

    it('returns invite details for a live room', async () => {
      redis.get.mockResolvedValue('room-1');
      redis.hgetall.mockResolvedValue({
        roomId: 'room-1',
        title: 'Friday Film',
        videoId: 'v1',
        passwordHash: 'hash',
      });
      redis.scard.mockResolvedValue(3);

      const result = await service.lookupInvite('CODE');

      expect(result).toMatchObject({
        roomId: 'room-1',
        title: 'Friday Film',
        videoId: 'v1',
        requirePassword: true,
        memberCount: 3,
      });
    });
  });

  describe('adminIsGloballyBanned', () => {
    it('returns false when there is no ban record', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.adminIsGloballyBanned('u1')).resolves.toBe(false);
    });

    it('returns true for a permanent ban', async () => {
      redis.get.mockResolvedValue('permanent');
      await expect(service.adminIsGloballyBanned('u1')).resolves.toBe(true);
    });

    it('expires a stale timed ban and returns false', async () => {
      redis.get.mockResolvedValue(String(Date.now() - 1000));

      await expect(service.adminIsGloballyBanned('u1')).resolves.toBe(false);
      expect(redis.del).toHaveBeenCalled();
    });
  });
});
