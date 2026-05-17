import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';

import { WatchPartyError } from '@app/common/exceptions';

import { WatchPartyService } from './service/watch-party.service';
import { WATCH_PARTY_REDIS } from './watch-party.constants';

const TEST_HOST = 'host-user';
const TEST_GUEST = 'guest-user';

const buildConfig = (overrides: Record<string, any> = {}) => {
  const defaults: Record<string, any> = {
    WATCH_PARTY_MAX_MEMBERS: 3,
    WATCH_PARTY_ROOM_TTL: 86400,
    WATCH_PARTY_HOST_GRACE_PERIOD: 30,
    WATCH_PARTY_CHAT_HISTORY_SIZE: 5,
    WATCH_PARTY_CHAT_RATE_LIMIT: 5,
    WATCH_PARTY_REACTION_RATE_LIMIT: 10,
    WATCH_PARTY_VIDEO_SYNC_THROTTLE: 500,
    ...overrides,
  };
  return {
    get: <T>(key: string, fallback?: T) => (defaults[key] ?? fallback) as T,
    getOrThrow: <T>(key: string) => defaults[key] as T,
  };
};

const setup = async (configOverrides: Record<string, any> = {}) => {
  const redis = new (RedisMock as any)() as unknown as Redis;
  await redis.flushall();
  const moduleRef = await Test.createTestingModule({
    providers: [
      WatchPartyService,
      { provide: WATCH_PARTY_REDIS, useValue: redis },
      { provide: ConfigService, useValue: buildConfig(configOverrides) },
    ],
  }).compile();
  const service = moduleRef.get(WatchPartyService);
  return { service, redis };
};

describe('WatchPartyService', () => {
  describe('createRoom', () => {
    it('creates a room with invite code and registers host as member', async () => {
      const { service, redis } = await setup();

      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'video-1',
        title: 'My Party',
      });

      expect(roomId).toBeTruthy();
      expect(inviteCode).toBeTruthy();

      const room = await redis.hgetall(`wp:room:${roomId}`);
      expect(room.hostId).toBe(TEST_HOST);
      expect(room.videoId).toBe('video-1');
      expect(room.passwordHash ?? '').toBe('');

      const members = await redis.smembers(`wp:room:${roomId}:members`);
      expect(members).toEqual([TEST_HOST]);

      const inviteRoom = await redis.get(`wp:invite:${inviteCode}`);
      expect(inviteRoom).toBe(roomId);

      const userRoom = await redis.get(`wp:user:${TEST_HOST}:room`);
      expect(userRoom).toBe(roomId);
    });

    it('hashes password when provided', async () => {
      const { service, redis } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
        password: 'secret123',
      });
      const room = await redis.hgetall(`wp:room:${roomId}`);
      expect(room.passwordHash).toBeTruthy();
      expect(room.passwordHash).not.toBe('secret123');
    });

    it('defaults isPublic=true and registers room in active+public sets', async () => {
      const { service, redis } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      const room = await redis.hgetall(`wp:room:${roomId}`);
      expect(room.isPublic).toBe('true');

      const activeIds = await redis.zrange('wp:rooms:active', 0, -1);
      const publicIds = await redis.zrange('wp:rooms:public', 0, -1);
      expect(activeIds).toContain(roomId);
      expect(publicIds).toContain(roomId);
    });

    it('isPublic=false keeps room out of the public set', async () => {
      const { service, redis } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
        isPublic: false,
      });
      const activeIds = await redis.zrange('wp:rooms:active', 0, -1);
      const publicIds = await redis.zrange('wp:rooms:public', 0, -1);
      expect(activeIds).toContain(roomId);
      expect(publicIds).not.toContain(roomId);
    });
  });

  describe('joinRoom', () => {
    it('lets a guest join with the right invite code', async () => {
      const { service } = await setup();
      const { inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });

      const state = await service.joinRoom(inviteCode, TEST_GUEST);
      expect(state.room.memberCount).toBe(2);
      expect(state.members.map((m) => m.userId).sort()).toEqual(
        [TEST_HOST, TEST_GUEST].sort(),
      );
    });

    it('rejects wrong password', async () => {
      const { service } = await setup();
      const { inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
        password: 'secret123',
      });
      await expect(
        service.joinRoom(inviteCode, TEST_GUEST, 'wrong'),
      ).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    });

    it('accepts correct password', async () => {
      const { service } = await setup();
      const { inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
        password: 'secret123',
      });
      const state = await service.joinRoom(inviteCode, TEST_GUEST, 'secret123');
      expect(state.members.length).toBe(2);
    });

    it('rejects when room is full', async () => {
      const { service } = await setup({ WATCH_PARTY_MAX_MEMBERS: 2 });
      const { inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, 'g1');
      await expect(service.joinRoom(inviteCode, 'g2')).rejects.toMatchObject({
        code: 'ROOM_FULL',
      });
    });

    it('throws NOT_FOUND for unknown invite', async () => {
      const { service } = await setup();
      await expect(
        service.joinRoom('does-not-exist', TEST_GUEST),
      ).rejects.toBeInstanceOf(WatchPartyError);
    });

    it('treats a re-join by the same user as idempotent', async () => {
      const { service } = await setup();
      const { inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      const state = await service.joinRoom(inviteCode, TEST_GUEST);
      expect(state.members.length).toBe(2);
    });
  });

  describe('leaveRoom & closeRoom', () => {
    it('removes member on leave', async () => {
      const { service, redis } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await service.leaveRoom(roomId, TEST_GUEST);
      const members = await redis.smembers(`wp:room:${roomId}:members`);
      expect(members).toEqual([TEST_HOST]);
      const userRoom = await redis.get(`wp:user:${TEST_GUEST}:room`);
      expect(userRoom).toBeNull();
    });

    it('purges all room keys on close', async () => {
      const { service, redis } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);

      await service.closeRoom(roomId, 'host_closed');

      const keys = await redis.keys(`wp:room:${roomId}*`);
      expect(keys).toEqual([]);
      expect(await redis.get(`wp:invite:${inviteCode}`)).toBeNull();
      expect(await redis.get(`wp:user:${TEST_HOST}:room`)).toBeNull();
      expect(await redis.get(`wp:user:${TEST_GUEST}:room`)).toBeNull();
    });

    it('closeRoom removes room from active and public sets', async () => {
      const { service, redis } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.closeRoom(roomId, 'host_closed');
      expect(await redis.zrange('wp:rooms:active', 0, -1)).not.toContain(
        roomId,
      );
      expect(await redis.zrange('wp:rooms:public', 0, -1)).not.toContain(
        roomId,
      );
    });
  });

  describe('chat & reactions', () => {
    it('persists and caps chat history', async () => {
      const { service, redis } = await setup({
        WATCH_PARTY_CHAT_HISTORY_SIZE: 3,
      });
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      for (let i = 0; i < 5; i++) {
        await service.sendMessage(roomId, TEST_HOST, 'Host', `msg-${i}`);
      }
      const stored = await redis.lrange(`wp:room:${roomId}:chat`, 0, -1);
      expect(stored.length).toBe(3);
      const texts = stored.map((s) => JSON.parse(s).text);
      expect(texts).toEqual(['msg-4', 'msg-3', 'msg-2']);
    });
  });

  describe('mute', () => {
    it('host mutes a guest; sendMessage rejects with MUTED', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);

      await service.muteMember(roomId, TEST_HOST, TEST_GUEST, 60);
      expect(await service.isMuted(roomId, TEST_GUEST)).toBe(true);

      await expect(
        service.sendMessage(roomId, TEST_GUEST, 'Guest', 'hi'),
      ).rejects.toMatchObject({ code: 'MUTED' });
    });

    it('mute auto-expires after duration', async () => {
      const { service, redis } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);

      const past = Date.now() - 1000;
      await redis.hset(`wp:room:${roomId}:mutes`, TEST_GUEST, String(past));

      expect(await service.isMuted(roomId, TEST_GUEST)).toBe(false);
      await expect(
        service.sendMessage(roomId, TEST_GUEST, 'Guest', 'hi'),
      ).resolves.toBeDefined();
    });

    it('non-host cannot mute', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await expect(
        service.muteMember(roomId, TEST_GUEST, TEST_HOST),
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' });
    });

    it('host cannot mute self', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await expect(
        service.muteMember(roomId, TEST_HOST, TEST_HOST),
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' });
    });

    it('unmute clears the entry', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await service.muteMember(roomId, TEST_HOST, TEST_GUEST);
      await service.unmuteMember(roomId, TEST_HOST, TEST_GUEST);
      expect(await service.isMuted(roomId, TEST_GUEST)).toBe(false);
    });
  });

  describe('ban', () => {
    it('removes the target from the room and blocks rejoin', async () => {
      const { service, redis } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);

      await service.banMember(roomId, TEST_HOST, TEST_GUEST, 60);

      expect(await service.isBanned(roomId, TEST_GUEST)).toBe(true);
      expect(await redis.smembers(`wp:room:${roomId}:members`)).toEqual([
        TEST_HOST,
      ]);
      expect(await redis.get(`wp:user:${TEST_GUEST}:room`)).toBeNull();

      await expect(
        service.joinRoom(inviteCode, TEST_GUEST),
      ).rejects.toMatchObject({ code: 'BANNED' });
    });

    it('expired ban allows rejoin', async () => {
      const { service, redis } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await service.banMember(roomId, TEST_HOST, TEST_GUEST, 60);

      const past = Date.now() - 1000;
      await redis.hset(`wp:room:${roomId}:bans`, TEST_GUEST, String(past));

      const state = await service.joinRoom(inviteCode, TEST_GUEST);
      expect(state.members.map((m) => m.userId).sort()).toEqual(
        [TEST_HOST, TEST_GUEST].sort(),
      );
    });

    it('permanent ban blocks indefinitely until unban', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await service.banMember(roomId, TEST_HOST, TEST_GUEST);

      await expect(
        service.joinRoom(inviteCode, TEST_GUEST),
      ).rejects.toMatchObject({ code: 'BANNED' });

      await service.unbanMember(roomId, TEST_HOST, TEST_GUEST);
      const state = await service.joinRoom(inviteCode, TEST_GUEST);
      expect(state.members.length).toBe(2);
    });

    it('non-host cannot ban; host cannot ban self', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);

      await expect(
        service.banMember(roomId, TEST_GUEST, TEST_HOST),
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' });
      await expect(
        service.banMember(roomId, TEST_HOST, TEST_HOST),
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' });
    });
  });

  describe('listActiveRooms', () => {
    it('lists public rooms newest first', async () => {
      const { service } = await setup();
      const a = await service.createRoom('h1', { videoId: 'v', title: 'A' });
      await new Promise((r) => setTimeout(r, 5));
      const b = await service.createRoom('h2', { videoId: 'v', title: 'B' });

      const { items, total } = await service.listActiveRooms({
        limit: 10,
        offset: 0,
        scope: 'public',
      });
      expect(total).toBe(2);
      expect(items.map((i) => i.roomId)).toEqual([b.roomId, a.roomId]);
      expect(items[0].title).toBe('B');
      expect(items[0].requirePassword).toBe(false);
    });

    it('excludes private rooms from public scope', async () => {
      const { service } = await setup();
      const pub = await service.createRoom('h1', {
        videoId: 'v',
        title: 'Public',
      });
      const priv = await service.createRoom('h2', {
        videoId: 'v',
        title: 'Private',
        isPublic: false,
      });
      const publicList = await service.listActiveRooms({
        scope: 'public',
        limit: 10,
        offset: 0,
      });
      expect(publicList.items.map((i) => i.roomId)).toEqual([pub.roomId]);

      const allList = await service.listActiveRooms({
        scope: 'all',
        limit: 10,
        offset: 0,
      });
      expect(allList.items.map((i) => i.roomId).sort()).toEqual(
        [pub.roomId, priv.roomId].sort(),
      );
    });

    it('paginates with limit and offset', async () => {
      const { service } = await setup();
      const created: string[] = [];
      for (let i = 0; i < 4; i++) {
        const { roomId } = await service.createRoom(`h${i}`, {
          videoId: 'v',
          title: `T${i}`,
        });
        created.push(roomId);
        await new Promise((r) => setTimeout(r, 2));
      }
      const first = await service.listActiveRooms({
        scope: 'public',
        limit: 2,
        offset: 0,
      });
      const second = await service.listActiveRooms({
        scope: 'public',
        limit: 2,
        offset: 2,
      });
      expect(first.items.map((i) => i.roomId)).toEqual(
        [...created].reverse().slice(0, 2),
      );
      expect(second.items.map((i) => i.roomId)).toEqual(
        [...created].reverse().slice(2, 4),
      );
    });

    it('lazy-cleans closed rooms from active sets', async () => {
      const { service, redis } = await setup();
      const { roomId } = await service.createRoom('h1', {
        videoId: 'v',
        title: 'Ghost',
      });
      // Simulate hash key expired but ZSET entry still present
      await redis.del(`wp:room:${roomId}`);

      const list = await service.listActiveRooms({
        scope: 'public',
        limit: 10,
        offset: 0,
      });
      expect(list.items).toEqual([]);
      expect(await redis.zrange('wp:rooms:public', 0, -1)).not.toContain(
        roomId,
      );
    });

    it('filters by videoId when provided', async () => {
      const { service } = await setup();
      const a = await service.createRoom('h1', {
        videoId: 'video-A',
        title: 'A',
      });
      await service.createRoom('h2', { videoId: 'video-B', title: 'B' });
      const list = await service.listActiveRooms({
        scope: 'public',
        limit: 10,
        offset: 0,
        videoId: 'video-A',
      });
      expect(list.items.map((i) => i.roomId)).toEqual([a.roomId]);
    });
  });

  describe('host check & video sync', () => {
    it('isHost returns true only for the host', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      expect(await service.isHost(roomId, TEST_HOST)).toBe(true);
      expect(await service.isHost(roomId, TEST_GUEST)).toBe(false);
    });

    it('syncVideo rejects non-host', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await expect(
        service.syncVideo(roomId, TEST_GUEST, {
          isPlaying: true,
          currentTime: 10,
        }),
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' });
    });

    it('syncVideo updates state for host', async () => {
      const { service, redis } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v',
        title: 't',
      });
      await service.syncVideo(roomId, TEST_HOST, {
        isPlaying: true,
        currentTime: 42,
      });
      const video = await redis.hgetall(`wp:room:${roomId}:video`);
      expect(video.isPlaying).toBe('true');
      expect(Number(video.currentTime)).toBe(42);
    });
  });

  describe('queue management', () => {
    const makeItem = (videoId: string) => ({
      videoId,
      title: `Video ${videoId}`,
      thumbnailUrl: undefined,
      durationSec: undefined,
    });

    it('enqueueVideo appends item to queue and returns updated list', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      const queue = await service.enqueueVideo(
        roomId,
        TEST_HOST,
        makeItem('v2'),
      );
      expect(queue).toHaveLength(1);
      expect(queue[0].videoId).toBe('v2');
      expect(queue[0].addedBy).toBe(TEST_HOST);
    });

    it('enqueueVideo rejects when queue is at max size', async () => {
      const { service } = await setup({
        WATCH_PARTY_QUEUE_MAX_SIZE: 2,
      });
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v3'));
      await expect(
        service.enqueueVideo(roomId, TEST_HOST, makeItem('v4')),
      ).rejects.toMatchObject({ code: 'QUEUE_FULL' });
    });

    it('enqueueVideo rejects non-host', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await expect(
        service.enqueueVideo(roomId, TEST_GUEST, makeItem('v2')),
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' });
    });

    it('removeFromQueue removes item at given index', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v3'));
      const queue = await service.removeFromQueue(roomId, TEST_HOST, 0);
      expect(queue).toHaveLength(1);
      expect(queue[0].videoId).toBe('v3');
    });

    it('removeFromQueue rejects out-of-range index', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      await expect(
        service.removeFromQueue(roomId, TEST_HOST, 5),
      ).rejects.toMatchObject({ code: 'INVALID_QUEUE_INDEX' });
    });

    it('reorderQueue swaps two items', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v3'));
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v4'));
      const queue = await service.reorderQueue(roomId, TEST_HOST, 0, 2);
      expect(queue.map((q) => q.videoId)).toEqual(['v4', 'v3', 'v2']);
    });

    it('reorderQueue rejects invalid from/to', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      await expect(
        service.reorderQueue(roomId, TEST_HOST, 0, 99),
      ).rejects.toMatchObject({ code: 'INVALID_QUEUE_INDEX' });
    });

    it('getRoomState includes queue', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      const state = await service.getRoomState(roomId);
      expect(state.queue).toHaveLength(1);
      expect(state.queue[0].videoId).toBe('v2');
    });

    it('closeRoom clears queue', async () => {
      const { service, redis } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      await service.closeRoom(roomId, 'host_closed');
      const len = await redis.llen(`wp:room:${roomId}:queue`);
      expect(len).toBe(0);
    });
  });

  describe('playNext / playNow / handleVideoEnd', () => {
    const makeItem = (videoId: string) => ({
      videoId,
      title: `Video ${videoId}`,
    });

    it('playNext advances to first queued video', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v3'));
      const result = await service.playNext(roomId, TEST_HOST);
      expect(result.nextItem?.videoId).toBe('v2');
      expect(result.videoState.videoId).toBe('v2');
      expect(result.videoState.isPlaying).toBe(true);
      expect(result.videoState.currentTime).toBe(0);
      expect(result.videoState.status).toBe('playing');
      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].videoId).toBe('v3');
    });

    it('playNext returns awaiting_host when queue is empty', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      const result = await service.playNext(roomId, TEST_HOST);
      expect(result.nextItem).toBeNull();
      expect(result.videoState.status).toBe('awaiting_host');
      expect(result.videoState.isPlaying).toBe(false);
    });

    it('playNow replaces current video immediately', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      const result = await service.playNow(roomId, TEST_HOST, makeItem('v9'));
      expect(result.videoState.videoId).toBe('v9');
      expect(result.videoState.status).toBe('playing');
      expect(result.videoState.isPlaying).toBe(true);
      // Queue unchanged (v2 still there)
      expect(result.queue).toHaveLength(1);
    });

    it('playNow rejects non-host', async () => {
      const { service } = await setup();
      const { roomId, inviteCode } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.joinRoom(inviteCode, TEST_GUEST);
      await expect(
        service.playNow(roomId, TEST_GUEST, makeItem('v9')),
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' });
    });

    it('handleVideoEnd advances to next video', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      const result = await service.handleVideoEnd(roomId, TEST_HOST, 'v1');
      expect(result.nextItem?.videoId).toBe('v2');
      expect(result.videoState.status).toBe('playing');
    });

    it('handleVideoEnd ignores stale videoId', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      await service.enqueueVideo(roomId, TEST_HOST, makeItem('v2'));
      // Advance to v2
      await service.playNext(roomId, TEST_HOST);
      // Late event for v1 — must be ignored
      const result = await service.handleVideoEnd(roomId, TEST_HOST, 'v1');
      expect(result.nextItem).toBeNull();
      // v2 still playing
      expect(result.videoState.videoId).toBe('v2');
    });

    it('handleVideoEnd sets awaiting_host when queue empty', async () => {
      const { service } = await setup();
      const { roomId } = await service.createRoom(TEST_HOST, {
        videoId: 'v1',
        title: 't',
      });
      const result = await service.handleVideoEnd(roomId, TEST_HOST, 'v1');
      expect(result.nextItem).toBeNull();
      expect(result.videoState.status).toBe('awaiting_host');
    });
  });
});
