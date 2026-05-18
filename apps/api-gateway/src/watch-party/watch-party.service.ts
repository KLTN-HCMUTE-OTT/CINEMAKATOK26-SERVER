import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { catchRpcError } from '@app/common/exceptions';
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
  RoomState,
  RoomSummary,
  VideoState,
  WATCH_PARTY_CLIENT,
  WATCH_PARTY_CMD,
} from '@app/common/dtos/watch-party';

@Injectable()
export class WatchPartyService {
  constructor(
    @Inject(WATCH_PARTY_CLIENT) private readonly client: ClientProxy,
  ) {}

  private send<T>(cmd: string, payload: unknown): Promise<T> {
    return firstValueFrom<T>(
      this.client.send({ cmd }, payload).pipe(catchRpcError()) as any,
    );
  }

  createRoom(
    hostId: string,
    input: CreateRoomInput,
    hostInfo?: MemberInput,
  ): Promise<CreateRoomResult> {
    return this.send(WATCH_PARTY_CMD.CREATE_ROOM, { hostId, input, hostInfo });
  }

  lookupInvite(inviteCode: string): Promise<InviteLookupResult> {
    return this.send(WATCH_PARTY_CMD.LOOKUP_INVITE, { inviteCode });
  }

  joinRoom(
    inviteCode: string,
    userId: string,
    password?: string,
    member?: MemberInput,
  ): Promise<RoomState> {
    return this.send(WATCH_PARTY_CMD.JOIN_ROOM, {
      inviteCode,
      userId,
      password,
      member,
    });
  }

  joinRoomById(
    roomId: string,
    userId: string,
    password?: string,
    member?: MemberInput,
  ): Promise<RoomState> {
    return this.send(WATCH_PARTY_CMD.JOIN_ROOM_BY_ID, {
      roomId,
      userId,
      password,
      member,
    });
  }

  leaveRoom(roomId: string, userId: string): Promise<void> {
    return this.send(WATCH_PARTY_CMD.LEAVE_ROOM, { roomId, userId });
  }

  closeRoom(roomId: string, reason: RoomCloseReason): Promise<void> {
    return this.send(WATCH_PARTY_CMD.CLOSE_ROOM, { roomId, reason });
  }

  isHost(roomId: string, userId: string): Promise<boolean> {
    return this.send(WATCH_PARTY_CMD.IS_HOST, { roomId, userId });
  }

  getRoomState(roomId: string): Promise<RoomState> {
    return this.send(WATCH_PARTY_CMD.GET_ROOM_STATE, { roomId });
  }

  getRoomSummary(roomId: string): Promise<RoomSummary | null> {
    return this.send(WATCH_PARTY_CMD.GET_ROOM_SUMMARY, { roomId });
  }

  getRoomIdForUser(userId: string): Promise<string | null> {
    return this.send(WATCH_PARTY_CMD.GET_ROOM_FOR_USER, { userId });
  }

  getMemberDisplayName(roomId: string, userId: string): Promise<string | null> {
    return this.send(WATCH_PARTY_CMD.GET_MEMBER_NAME, { roomId, userId });
  }

  listActiveRooms(
    query: ListActiveRoomsQuery,
  ): Promise<{ items: RoomListItem[]; total: number }> {
    return this.send(WATCH_PARTY_CMD.LIST_ACTIVE_ROOMS, query);
  }

  syncVideo(
    roomId: string,
    userId: string,
    state: { isPlaying: boolean; currentTime: number },
  ): Promise<VideoState> {
    return this.send(WATCH_PARTY_CMD.SYNC_VIDEO, { roomId, userId, state });
  }

  sendMessage(
    roomId: string,
    userId: string,
    displayName: string,
    text: string,
  ): Promise<ChatMessage> {
    return this.send(WATCH_PARTY_CMD.SEND_MESSAGE, {
      roomId,
      userId,
      displayName,
      text,
    });
  }

  pushSystemMessage(roomId: string, text: string): Promise<ChatMessage> {
    return this.send(WATCH_PARTY_CMD.PUSH_SYSTEM_MESSAGE, { roomId, text });
  }

  sendReaction(userId: string, emoji: string): Promise<Reaction> {
    return this.send(WATCH_PARTY_CMD.SEND_REACTION, { userId, emoji });
  }

  muteMember(
    roomId: string,
    actorId: string,
    targetId: string,
    durationSec?: number,
  ): Promise<ModerationEntry> {
    return this.send(WATCH_PARTY_CMD.MUTE_MEMBER, {
      roomId,
      actorId,
      targetId,
      durationSec,
    });
  }

  unmuteMember(
    roomId: string,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    return this.send(WATCH_PARTY_CMD.UNMUTE_MEMBER, {
      roomId,
      actorId,
      targetId,
    });
  }

  banMember(
    roomId: string,
    actorId: string,
    targetId: string,
    durationSec?: number,
  ): Promise<ModerationEntry> {
    return this.send(WATCH_PARTY_CMD.BAN_MEMBER, {
      roomId,
      actorId,
      targetId,
      durationSec,
    });
  }

  unbanMember(
    roomId: string,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    return this.send(WATCH_PARTY_CMD.UNBAN_MEMBER, {
      roomId,
      actorId,
      targetId,
    });
  }

  getQueue(roomId: string): Promise<QueueItem[]> {
    return this.send(WATCH_PARTY_CMD.GET_QUEUE, { roomId });
  }

  enqueueVideo(
    roomId: string,
    hostId: string,
    item: Omit<QueueItem, 'addedBy' | 'addedAt'>,
  ): Promise<QueueItem[]> {
    return this.send(WATCH_PARTY_CMD.ENQUEUE_VIDEO, { roomId, hostId, item });
  }

  removeFromQueue(
    roomId: string,
    hostId: string,
    index: number,
  ): Promise<QueueItem[]> {
    return this.send(WATCH_PARTY_CMD.REMOVE_FROM_QUEUE, {
      roomId,
      hostId,
      index,
    });
  }

  reorderQueue(
    roomId: string,
    hostId: string,
    from: number,
    to: number,
  ): Promise<QueueItem[]> {
    return this.send(WATCH_PARTY_CMD.REORDER_QUEUE, {
      roomId,
      hostId,
      from,
      to,
    });
  }

  playNext(
    roomId: string,
    hostId: string,
  ): Promise<{
    videoState: VideoState;
    queue: QueueItem[];
    nextItem: QueueItem | null;
  }> {
    return this.send(WATCH_PARTY_CMD.PLAY_NEXT, { roomId, hostId });
  }

  playNow(
    roomId: string,
    hostId: string,
    item: Omit<QueueItem, 'addedBy' | 'addedAt'>,
  ): Promise<{ videoState: VideoState; queue: QueueItem[] }> {
    return this.send(WATCH_PARTY_CMD.PLAY_NOW, { roomId, hostId, item });
  }

  handleVideoEnd(
    roomId: string,
    hostId: string,
    videoId?: string,
  ): Promise<{
    videoState: VideoState;
    queue: QueueItem[];
    nextItem: QueueItem | null;
  }> {
    return this.send(WATCH_PARTY_CMD.HANDLE_VIDEO_END, {
      roomId,
      hostId,
      videoId,
    });
  }

  adminListAllRooms(query: {
    limit: number;
    offset: number;
    search?: string;
    videoId?: string;
  }): Promise<{ items: RoomListItem[]; total: number }> {
    return this.send(WATCH_PARTY_CMD.ADMIN_LIST_ALL_ROOMS, query);
  }

  adminGetRoomDetails(roomId: string): Promise<any> {
    return this.send(WATCH_PARTY_CMD.ADMIN_GET_ROOM_DETAILS, { roomId });
  }

  adminCloseRoom(
    roomId: string,
    adminId: string,
    reason?: string,
  ): Promise<{ closed: true; memberIds: string[] }> {
    return this.send(WATCH_PARTY_CMD.ADMIN_CLOSE_ROOM, { roomId, adminId, reason });
  }

  adminKickMember(
    roomId: string,
    adminId: string,
    targetId: string,
  ): Promise<{ kicked: true; targetId: string }> {
    return this.send(WATCH_PARTY_CMD.ADMIN_KICK_MEMBER, { roomId, adminId, targetId });
  }

  adminGetStats(): Promise<{
    totalActiveRooms: number;
    totalPublicRooms: number;
    totalMembers: number;
  }> {
    return this.send(WATCH_PARTY_CMD.ADMIN_GET_STATS, {});
  }

  adminBanUser(userId: string, durationSec?: number): Promise<void> {
    return this.send(WATCH_PARTY_CMD.ADMIN_BAN_USER, { userId, durationSec });
  }

  adminUnbanUser(userId: string): Promise<void> {
    return this.send(WATCH_PARTY_CMD.ADMIN_UNBAN_USER, { userId });
  }
}
