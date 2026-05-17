import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import type Redis from 'ioredis';

import { WatchPartyError } from '@app/common/exceptions';
import {
  ChatMessage,
  CreateRoomInput,
  CreateRoomResult,
  InviteLookupResult,
  ListActiveRoomsQuery,
  MemberInput,
  ModerationEntry,
  QueueItem,
  Reaction,
  RoomCloseReason,
  RoomListItem,
  RoomMember,
  RoomState,
  RoomSummary,
  VideoState,
} from '@app/common/dtos/watch-party';

import {
  SYSTEM_USER_ID,
  WATCH_PARTY_REDIS,
  WP_KEYS,
} from '../watch-party.constants';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LEN = 8;

const generateInviteCode = (): string => {
  const bytes = randomBytes(INVITE_LEN);
  let out = '';
  for (let i = 0; i < INVITE_LEN; i++) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return out;
};

const toBool = (v: string | undefined) => v === 'true' || v === '1';

@Injectable()
export class WatchPartyService {
  private readonly logger = new Logger(WatchPartyService.name);
  private readonly maxMembers: number;
  private readonly roomTtl: number;
  private readonly chatHistorySize: number;
  private readonly chatRateLimit: number;
  private readonly reactionRateLimit: number;
  private readonly queueMaxSize: number;

  constructor(
    @Inject(WATCH_PARTY_REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.maxMembers = Number(this.config.get('WATCH_PARTY_MAX_MEMBERS', 10));
    this.roomTtl = Number(this.config.get('WATCH_PARTY_ROOM_TTL', 86400));
    this.chatHistorySize = Number(
      this.config.get('WATCH_PARTY_CHAT_HISTORY_SIZE', 200),
    );
    this.chatRateLimit = Number(
      this.config.get('WATCH_PARTY_CHAT_RATE_LIMIT', 5),
    );
    this.reactionRateLimit = Number(
      this.config.get('WATCH_PARTY_REACTION_RATE_LIMIT', 10),
    );
    this.queueMaxSize = Number(
      this.config.get('WATCH_PARTY_QUEUE_MAX_SIZE', 20),
    );
  }

  async createRoom(
    hostId: string,
    input: CreateRoomInput,
    hostInfo: MemberInput = { displayName: 'Host' },
  ): Promise<CreateRoomResult> {
    const existing = await this.redis.get(WP_KEYS.userRoom(hostId));
    if (existing) {
      const stillThere = await this.redis.exists(WP_KEYS.room(existing));
      if (stillThere) {
        await this.leaveRoom(existing, hostId).catch(() => undefined);
      } else {
        await this.redis.del(WP_KEYS.userRoom(hostId));
      }
    }

    const roomId = randomUUID();
    const inviteCode = await this.allocateInviteCode();
    const now = Date.now();

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 10)
      : '';
    const isPublic = input.isPublic ?? true;

    const roomKey = WP_KEYS.room(roomId);
    const videoKey = WP_KEYS.video(roomId);
    const membersKey = WP_KEYS.members(roomId);
    const memberInfoKey = WP_KEYS.memberInfo(roomId);

    const pipeline = this.redis.multi();
    pipeline.hset(roomKey, {
      roomId,
      hostId,
      videoId: input.videoId,
      title: input.title,
      passwordHash,
      maxMembers: String(this.maxMembers),
      inviteCode,
      isPublic: isPublic ? 'true' : 'false',
      createdAt: String(now),
    });
    pipeline.expire(roomKey, this.roomTtl);
    pipeline.hset(videoKey, {
      isPlaying: 'false',
      currentTime: '0',
      lastUpdatedAt: String(now),
      videoId: input.videoId,
      startedAt: '',
      status: 'playing',
    });
    pipeline.expire(videoKey, this.roomTtl);
    pipeline.sadd(membersKey, hostId);
    pipeline.expire(membersKey, this.roomTtl);
    pipeline.hset(
      memberInfoKey,
      hostId,
      JSON.stringify({
        userId: hostId,
        displayName: hostInfo.displayName,
        avatarUrl: hostInfo.avatarUrl,
        joinedAt: now,
      }),
    );
    pipeline.expire(memberInfoKey, this.roomTtl);
    pipeline.set(WP_KEYS.invite(inviteCode), roomId, 'EX', this.roomTtl);
    pipeline.set(WP_KEYS.userRoom(hostId), roomId, 'EX', this.roomTtl);
    pipeline.zadd(WP_KEYS.activeRooms, now, roomId);
    if (isPublic) {
      pipeline.zadd(WP_KEYS.publicRooms, now, roomId);
    }
    await pipeline.exec();

    return { roomId, inviteCode };
  }

  async lookupInvite(inviteCode: string): Promise<InviteLookupResult> {
    const roomId = await this.redis.get(WP_KEYS.invite(inviteCode));
    if (!roomId) throw new WatchPartyError('NOT_FOUND', 'Invite not found');
    const room = await this.redis.hgetall(WP_KEYS.room(roomId));
    if (!room || !room.roomId) {
      await this.redis.del(WP_KEYS.invite(inviteCode));
      throw new WatchPartyError('NOT_FOUND', 'Room expired');
    }
    const memberCount = await this.redis.scard(WP_KEYS.members(roomId));
    return {
      roomId,
      title: room.title,
      videoId: room.videoId,
      requirePassword: Boolean(room.passwordHash),
      memberCount,
      maxMembers: Number(room.maxMembers || this.maxMembers),
    };
  }

  async joinRoom(
    inviteCode: string,
    userId: string,
    password?: string,
    member: MemberInput = { displayName: 'Guest' },
  ): Promise<RoomState> {
    const roomId = await this.redis.get(WP_KEYS.invite(inviteCode));
    if (!roomId) throw new WatchPartyError('NOT_FOUND', 'Invite not found');
    return this.joinRoomById(roomId, userId, password, member);
  }

  async joinRoomById(
    roomId: string,
    userId: string,
    password?: string,
    member: MemberInput = { displayName: 'Guest' },
  ): Promise<RoomState> {
    const room = await this.redis.hgetall(WP_KEYS.room(roomId));
    if (!room || !room.roomId) {
      throw new WatchPartyError('NOT_FOUND', 'Room not found');
    }

    if (room.hostId !== userId && (await this.isBanned(roomId, userId))) {
      throw new WatchPartyError('BANNED', 'You are banned from this room');
    }

    if (room.passwordHash && room.hostId !== userId) {
      if (!password) {
        throw new WatchPartyError('WRONG_PASSWORD', 'Password required');
      }
      const ok = await bcrypt.compare(password, room.passwordHash);
      if (!ok) {
        throw new WatchPartyError('WRONG_PASSWORD', 'Incorrect password');
      }
    }

    const isAlreadyMember = await this.redis.sismember(
      WP_KEYS.members(roomId),
      userId,
    );

    if (!isAlreadyMember) {
      const memberCount = await this.redis.scard(WP_KEYS.members(roomId));
      const max = Number(room.maxMembers || this.maxMembers);
      if (memberCount >= max) {
        throw new WatchPartyError('ROOM_FULL', 'Room is full');
      }

      const otherRoom = await this.redis.get(WP_KEYS.userRoom(userId));
      if (otherRoom && otherRoom !== roomId) {
        await this.leaveRoom(otherRoom, userId).catch(() => undefined);
      }

      const now = Date.now();
      const pipeline = this.redis.multi();
      pipeline.sadd(WP_KEYS.members(roomId), userId);
      pipeline.hset(
        WP_KEYS.memberInfo(roomId),
        userId,
        JSON.stringify({
          userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          joinedAt: now,
        }),
      );
      pipeline.set(WP_KEYS.userRoom(userId), roomId, 'EX', this.roomTtl);
      await pipeline.exec();
    }

    return this.getRoomState(roomId);
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.srem(WP_KEYS.members(roomId), userId);
    pipeline.hdel(WP_KEYS.memberInfo(roomId), userId);
    pipeline.del(WP_KEYS.userRoom(userId));
    await pipeline.exec();
  }

  async closeRoom(roomId: string, _reason: RoomCloseReason): Promise<void> {
    const room = await this.redis.hgetall(WP_KEYS.room(roomId));
    const members = await this.redis.smembers(WP_KEYS.members(roomId));

    const pipeline = this.redis.multi();
    pipeline.del(
      WP_KEYS.room(roomId),
      WP_KEYS.video(roomId),
      WP_KEYS.members(roomId),
      WP_KEYS.memberInfo(roomId),
      WP_KEYS.chat(roomId),
      WP_KEYS.bans(roomId),
      WP_KEYS.mutes(roomId),
      WP_KEYS.queue(roomId),
    );
    if (room.inviteCode) {
      pipeline.del(WP_KEYS.invite(room.inviteCode));
    }
    for (const userId of members) {
      pipeline.del(WP_KEYS.userRoom(userId));
    }
    pipeline.zrem(WP_KEYS.activeRooms, roomId);
    pipeline.zrem(WP_KEYS.publicRooms, roomId);
    await pipeline.exec();
  }

  async isHost(roomId: string, userId: string): Promise<boolean> {
    const hostId = await this.redis.hget(WP_KEYS.room(roomId), 'hostId');
    return hostId === userId;
  }

  async getRoomSummary(roomId: string): Promise<RoomSummary | null> {
    const room = await this.redis.hgetall(WP_KEYS.room(roomId));
    if (!room || !room.roomId) return null;
    const memberCount = await this.redis.scard(WP_KEYS.members(roomId));
    return {
      roomId,
      inviteCode: room.inviteCode,
      hostId: room.hostId,
      videoId: room.videoId,
      title: room.title,
      requirePassword: Boolean(room.passwordHash),
      isPublic: room.isPublic !== 'false',
      maxMembers: Number(room.maxMembers || this.maxMembers),
      memberCount,
      createdAt: Number(room.createdAt || 0),
    };
  }

  async getRoomState(roomId: string): Promise<RoomState> {
    const summary = await this.getRoomSummary(roomId);
    if (!summary) throw new WatchPartyError('NOT_FOUND', 'Room not found');

    const [memberInfo, videoRaw, chatRaw, queueRaw] = await Promise.all([
      this.redis.hgetall(WP_KEYS.memberInfo(roomId)),
      this.redis.hgetall(WP_KEYS.video(roomId)),
      this.redis.lrange(WP_KEYS.chat(roomId), 0, this.chatHistorySize - 1),
      this.redis.lrange(WP_KEYS.queue(roomId), 0, -1),
    ]);

    const members: RoomMember[] = Object.values(memberInfo)
      .map((raw) => {
        try {
          return JSON.parse(raw) as RoomMember;
        } catch {
          return null as unknown as RoomMember;
        }
      })
      .filter(Boolean);

    const videoState: VideoState = {
      isPlaying: toBool(videoRaw.isPlaying),
      currentTime: Number(videoRaw.currentTime || 0),
      lastUpdatedAt: Number(videoRaw.lastUpdatedAt || 0),
      videoId: videoRaw.videoId ?? summary.videoId,
      startedAt: videoRaw.startedAt ? Number(videoRaw.startedAt) : null,
      status: (videoRaw.status as VideoState['status']) ?? 'playing',
    };

    const recentMessages: ChatMessage[] = chatRaw
      .map((raw) => {
        try {
          return JSON.parse(raw) as ChatMessage;
        } catch {
          return null;
        }
      })
      .filter((m): m is ChatMessage => Boolean(m))
      .reverse();

    const queue: QueueItem[] = queueRaw
      .map((raw) => {
        try {
          return JSON.parse(raw) as QueueItem;
        } catch {
          return null;
        }
      })
      .filter((q): q is QueueItem => Boolean(q));

    return { room: summary, members, videoState, recentMessages, queue };
  }

  async syncVideo(
    roomId: string,
    userId: string,
    state: { isPlaying: boolean; currentTime: number },
  ): Promise<VideoState> {
    const host = await this.isHost(roomId, userId);
    if (!host) {
      throw new WatchPartyError('NOT_AUTHORIZED', 'Only host can sync video');
    }
    const now = Date.now();
    const existing = await this.redis.hgetall(WP_KEYS.video(roomId));
    await this.redis.hset(WP_KEYS.video(roomId), {
      isPlaying: state.isPlaying ? 'true' : 'false',
      currentTime: String(state.currentTime),
      lastUpdatedAt: String(now),
    });
    return {
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      lastUpdatedAt: now,
      videoId: existing.videoId ?? '',
      startedAt: existing.startedAt ? Number(existing.startedAt) : null,
      status: (existing.status as VideoState['status']) ?? 'playing',
    };
  }

  async sendMessage(
    roomId: string,
    userId: string,
    displayName: string,
    text: string,
  ): Promise<ChatMessage> {
    if (await this.isMuted(roomId, userId)) {
      throw new WatchPartyError('MUTED', 'You are muted in this room');
    }
    await this.enforceRate(`wp:rl:chat:${userId}`, this.chatRateLimit, 10);
    const message: ChatMessage = {
      id: randomUUID(),
      userId,
      displayName,
      text,
      createdAt: Date.now(),
    };
    const pipeline = this.redis.multi();
    pipeline.lpush(WP_KEYS.chat(roomId), JSON.stringify(message));
    pipeline.ltrim(WP_KEYS.chat(roomId), 0, this.chatHistorySize - 1);
    pipeline.expire(WP_KEYS.chat(roomId), this.roomTtl);
    await pipeline.exec();
    return message;
  }

  async sendReaction(userId: string, emoji: string): Promise<Reaction> {
    await this.enforceRate(`wp:rl:react:${userId}`, this.reactionRateLimit, 1);
    return {
      id: randomUUID(),
      userId,
      emoji,
      createdAt: Date.now(),
    };
  }

  async getRoomIdForUser(userId: string): Promise<string | null> {
    return this.redis.get(WP_KEYS.userRoom(userId));
  }

  async getMemberDisplayName(
    roomId: string,
    userId: string,
  ): Promise<string | null> {
    const raw = await this.redis.hget(WP_KEYS.memberInfo(roomId), userId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { displayName?: string };
      return parsed.displayName ?? null;
    } catch {
      return null;
    }
  }

  async pushSystemMessage(roomId: string, text: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: randomUUID(),
      userId: SYSTEM_USER_ID,
      displayName: 'System',
      text,
      createdAt: Date.now(),
    };
    const pipeline = this.redis.multi();
    pipeline.lpush(WP_KEYS.chat(roomId), JSON.stringify(message));
    pipeline.ltrim(WP_KEYS.chat(roomId), 0, this.chatHistorySize - 1);
    pipeline.expire(WP_KEYS.chat(roomId), this.roomTtl);
    await pipeline.exec();
    return message;
  }

  async banMember(
    roomId: string,
    actorId: string,
    targetId: string,
    durationSec?: number,
  ): Promise<ModerationEntry> {
    const entry = await this.applyModeration({
      kind: 'ban',
      roomId,
      actorId,
      targetId,
      durationSec,
    });
    await this.leaveRoom(roomId, targetId);
    return entry;
  }

  async unbanMember(
    roomId: string,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    await this.assertHost(roomId, actorId);
    await this.redis.hdel(WP_KEYS.bans(roomId), targetId);
  }

  async isBanned(roomId: string, userId: string): Promise<boolean> {
    return this.checkActive(WP_KEYS.bans(roomId), userId);
  }

  async listBans(roomId: string): Promise<ModerationEntry[]> {
    return this.listModeration(WP_KEYS.bans(roomId));
  }

  async muteMember(
    roomId: string,
    actorId: string,
    targetId: string,
    durationSec?: number,
  ): Promise<ModerationEntry> {
    return this.applyModeration({
      kind: 'mute',
      roomId,
      actorId,
      targetId,
      durationSec,
    });
  }

  async unmuteMember(
    roomId: string,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    await this.assertHost(roomId, actorId);
    await this.redis.hdel(WP_KEYS.mutes(roomId), targetId);
  }

  async isMuted(roomId: string, userId: string): Promise<boolean> {
    return this.checkActive(WP_KEYS.mutes(roomId), userId);
  }

  async listMutes(roomId: string): Promise<ModerationEntry[]> {
    return this.listModeration(WP_KEYS.mutes(roomId));
  }

  async getQueue(roomId: string): Promise<QueueItem[]> {
    const raw = await this.redis.lrange(WP_KEYS.queue(roomId), 0, -1);
    return raw
      .map((r) => {
        try {
          return JSON.parse(r) as QueueItem;
        } catch {
          return null;
        }
      })
      .filter((q): q is QueueItem => Boolean(q));
  }

  async enqueueVideo(
    roomId: string,
    hostId: string,
    item: Omit<QueueItem, 'addedBy' | 'addedAt'>,
  ): Promise<QueueItem[]> {
    await this.assertHost(roomId, hostId);
    const currentSize = await this.redis.llen(WP_KEYS.queue(roomId));
    if (currentSize >= this.queueMaxSize) {
      throw new WatchPartyError(
        'QUEUE_FULL',
        `Queue is full (max ${this.queueMaxSize})`,
      );
    }
    const entry: QueueItem = { ...item, addedBy: hostId, addedAt: Date.now() };
    await this.redis.rpush(WP_KEYS.queue(roomId), JSON.stringify(entry));
    await this.redis.expire(WP_KEYS.queue(roomId), this.roomTtl);
    return this.getQueue(roomId);
  }

  async removeFromQueue(
    roomId: string,
    hostId: string,
    index: number,
  ): Promise<QueueItem[]> {
    await this.assertHost(roomId, hostId);
    const raw = await this.redis.lrange(WP_KEYS.queue(roomId), 0, -1);
    if (index < 0 || index >= raw.length) {
      throw new WatchPartyError('INVALID_QUEUE_INDEX', 'Index out of range');
    }
    // Sentinel-based removal: set a unique placeholder, then LREM 1 occurrence
    const sentinel = `__del_${Date.now()}_${Math.random()}__`;
    await this.redis.lset(WP_KEYS.queue(roomId), index, sentinel);
    await this.redis.lrem(WP_KEYS.queue(roomId), 1, sentinel);
    return this.getQueue(roomId);
  }

  async reorderQueue(
    roomId: string,
    hostId: string,
    from: number,
    to: number,
  ): Promise<QueueItem[]> {
    await this.assertHost(roomId, hostId);
    const raw = await this.redis.lrange(WP_KEYS.queue(roomId), 0, -1);
    if (
      from < 0 ||
      from >= raw.length ||
      to < 0 ||
      to >= raw.length ||
      from === to
    ) {
      throw new WatchPartyError(
        'INVALID_QUEUE_INDEX',
        'Invalid from/to index',
      );
    }
    // Swap items by re-setting positions
    await this.redis.lset(WP_KEYS.queue(roomId), from, raw[to]);
    await this.redis.lset(WP_KEYS.queue(roomId), to, raw[from]);
    return this.getQueue(roomId);
  }

  async playNow(
    roomId: string,
    hostId: string,
    item: Omit<QueueItem, 'addedBy' | 'addedAt'>,
  ): Promise<{ videoState: VideoState; queue: QueueItem[] }> {
    await this.assertHost(roomId, hostId);
    const now = Date.now();
    // Update room hash current videoId
    await this.redis.hset(WP_KEYS.room(roomId), 'videoId', item.videoId);
    // Reset video state
    await this.redis.hset(WP_KEYS.video(roomId), {
      isPlaying: 'true',
      currentTime: '0',
      lastUpdatedAt: String(now),
      videoId: item.videoId,
      startedAt: String(now),
      status: 'playing',
    });
    const queue = await this.getQueue(roomId);
    const videoState: VideoState = {
      isPlaying: true,
      currentTime: 0,
      lastUpdatedAt: now,
      videoId: item.videoId,
      startedAt: now,
      status: 'playing',
    };
    return { videoState, queue };
  }

  async playNext(
    roomId: string,
    hostId: string,
  ): Promise<{
    videoState: VideoState;
    queue: QueueItem[];
    nextItem: QueueItem | null;
  }> {
    await this.assertHost(roomId, hostId);
    const raw = await this.redis.lpop(WP_KEYS.queue(roomId));
    const queue = await this.getQueue(roomId);

    if (!raw) {
      const now = Date.now();
      await this.redis.hset(WP_KEYS.video(roomId), {
        isPlaying: 'false',
        lastUpdatedAt: String(now),
        status: 'awaiting_host',
      });
      const existing = await this.redis.hgetall(WP_KEYS.video(roomId));
      const videoState: VideoState = {
        isPlaying: false,
        currentTime: Number(existing.currentTime || 0),
        lastUpdatedAt: now,
        videoId: existing.videoId ?? '',
        startedAt: existing.startedAt ? Number(existing.startedAt) : null,
        status: 'awaiting_host',
      };
      return { videoState, queue, nextItem: null };
    }

    let nextItem: QueueItem | null = null;
    try {
      nextItem = JSON.parse(raw) as QueueItem;
    } catch {
      nextItem = null;
    }

    const now = Date.now();
    const videoId = nextItem?.videoId ?? '';
    await this.redis.hset(WP_KEYS.room(roomId), 'videoId', videoId);
    await this.redis.hset(WP_KEYS.video(roomId), {
      isPlaying: 'true',
      currentTime: '0',
      lastUpdatedAt: String(now),
      videoId,
      startedAt: String(now),
      status: 'playing',
    });

    const videoState: VideoState = {
      isPlaying: true,
      currentTime: 0,
      lastUpdatedAt: now,
      videoId,
      startedAt: now,
      status: 'playing',
    };
    return { videoState, queue, nextItem };
  }

  async handleVideoEnd(
    roomId: string,
    hostId: string,
    videoId?: string,
  ): Promise<{
    videoState: VideoState;
    queue: QueueItem[];
    nextItem: QueueItem | null;
  }> {
    await this.assertHost(roomId, hostId);
    // Idempotency: if client sends videoId, verify it matches current
    if (videoId) {
      const currentVideoId = await this.redis.hget(
        WP_KEYS.video(roomId),
        'videoId',
      );
      if (currentVideoId && currentVideoId !== videoId) {
        // Stale event from a previous video — ignore
        const queue = await this.getQueue(roomId);
        const existing = await this.redis.hgetall(WP_KEYS.video(roomId));
        const videoState: VideoState = {
          isPlaying: toBool(existing.isPlaying),
          currentTime: Number(existing.currentTime || 0),
          lastUpdatedAt: Number(existing.lastUpdatedAt || 0),
          videoId: existing.videoId ?? '',
          startedAt: existing.startedAt ? Number(existing.startedAt) : null,
          status: (existing.status as VideoState['status']) ?? 'playing',
        };
        return { videoState, queue, nextItem: null };
      }
    }
    return this.playNext(roomId, hostId);
  }

  async listActiveRooms(
    query: ListActiveRoomsQuery,
  ): Promise<{ items: RoomListItem[]; total: number }> {
    const key =
      query.scope === 'all' ? WP_KEYS.activeRooms : WP_KEYS.publicRooms;
    const total = await this.redis.zcard(key);
    if (total === 0) return { items: [], total: 0 };

    const fetchLimit = Math.max(query.limit * 2, query.limit + 8);
    const candidates = await this.redis.zrevrange(
      key,
      query.offset,
      query.offset + fetchLimit - 1,
    );
    if (candidates.length === 0) return { items: [], total };

    const items: RoomListItem[] = [];
    const stale: string[] = [];

    for (const roomId of candidates) {
      if (items.length >= query.limit) break;
      const room = await this.redis.hgetall(WP_KEYS.room(roomId));
      if (!room || !room.roomId) {
        stale.push(roomId);
        continue;
      }
      if (query.videoId && room.videoId !== query.videoId) {
        continue;
      }
      const memberCount = await this.redis.scard(WP_KEYS.members(roomId));
      items.push({
        roomId,
        title: room.title,
        videoId: room.videoId,
        hostId: room.hostId,
        requirePassword: Boolean(room.passwordHash),
        isPublic: room.isPublic !== 'false',
        memberCount,
        maxMembers: Number(room.maxMembers || this.maxMembers),
        createdAt: Number(room.createdAt || 0),
      });
    }

    if (stale.length > 0) {
      const cleanup = this.redis.multi();
      cleanup.zrem(WP_KEYS.activeRooms, ...stale);
      cleanup.zrem(WP_KEYS.publicRooms, ...stale);
      await cleanup.exec();
    }

    const effectiveTotal = total - stale.length;
    return { items, total: Math.max(effectiveTotal, 0) };
  }

  private async applyModeration(args: {
    kind: 'mute' | 'ban';
    roomId: string;
    actorId: string;
    targetId: string;
    durationSec?: number;
  }): Promise<ModerationEntry> {
    const { kind, roomId, actorId, targetId, durationSec } = args;
    if (actorId === targetId) {
      throw new WatchPartyError(
        'NOT_AUTHORIZED',
        'You cannot moderate yourself',
      );
    }
    await this.assertHost(roomId, actorId);
    const until =
      durationSec && durationSec > 0 ? Date.now() + durationSec * 1000 : null;
    const key = kind === 'mute' ? WP_KEYS.mutes(roomId) : WP_KEYS.bans(roomId);
    await this.redis.hset(
      key,
      targetId,
      until === null ? 'permanent' : String(until),
    );
    return { userId: targetId, until };
  }

  private async assertHost(roomId: string, actorId: string): Promise<void> {
    const hostId = await this.redis.hget(WP_KEYS.room(roomId), 'hostId');
    if (!hostId) {
      throw new WatchPartyError('NOT_FOUND', 'Room not found');
    }
    if (hostId !== actorId) {
      throw new WatchPartyError('NOT_AUTHORIZED', 'Only host can moderate');
    }
  }

  private async checkActive(key: string, userId: string): Promise<boolean> {
    const raw = await this.redis.hget(key, userId);
    if (!raw) return false;
    if (raw === 'permanent') return true;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= Date.now()) {
      await this.redis.hdel(key, userId);
      return false;
    }
    return true;
  }

  private async listModeration(key: string): Promise<ModerationEntry[]> {
    const all = await this.redis.hgetall(key);
    const now = Date.now();
    const expired: string[] = [];
    const result: ModerationEntry[] = [];
    for (const [userId, raw] of Object.entries(all)) {
      if (raw === 'permanent') {
        result.push({ userId, until: null });
        continue;
      }
      const until = Number(raw);
      if (!Number.isFinite(until) || until <= now) {
        expired.push(userId);
        continue;
      }
      result.push({ userId, until });
    }
    if (expired.length > 0) {
      await this.redis.hdel(key, ...expired);
    }
    return result;
  }

  private async enforceRate(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSec);
    }
    if (count > limit) {
      throw new WatchPartyError('RATE_LIMITED', 'Too many requests');
    }
  }

  private async allocateInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const existing = await this.redis.get(WP_KEYS.invite(code));
      if (!existing) return code;
    }
    throw new WatchPartyError(
      'INTERNAL_ERROR',
      'Failed to allocate invite code',
    );
  }
}
