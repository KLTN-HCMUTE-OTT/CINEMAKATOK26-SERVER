import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { WATCH_PARTY_CMD } from '@app/common/dtos/watch-party';
import type {
  CreateRoomInput,
  ListActiveRoomsQuery,
  MemberInput,
  QueueItem,
  RoomCloseReason,
} from '@app/common/dtos/watch-party';

import { WatchPartyService } from '../service/watch-party.service';

@Controller()
export class WatchPartyController {
  constructor(private readonly service: WatchPartyService) {}

  @MessagePattern({ cmd: WATCH_PARTY_CMD.CREATE_ROOM })
  createRoom(
    @Payload()
    payload: {
      hostId: string;
      input: CreateRoomInput;
      hostInfo?: MemberInput;
    },
  ) {
    return this.service.createRoom(
      payload.hostId,
      payload.input,
      payload.hostInfo,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.LOOKUP_INVITE })
  lookupInvite(@Payload() payload: { inviteCode: string }) {
    return this.service.lookupInvite(payload.inviteCode);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.JOIN_ROOM })
  joinRoom(
    @Payload()
    payload: {
      inviteCode: string;
      userId: string;
      password?: string;
      member?: MemberInput;
    },
  ) {
    return this.service.joinRoom(
      payload.inviteCode,
      payload.userId,
      payload.password,
      payload.member,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.JOIN_ROOM_BY_ID })
  joinRoomById(
    @Payload()
    payload: {
      roomId: string;
      userId: string;
      password?: string;
      member?: MemberInput;
      actorIsAdmin?: boolean;
    },
  ) {
    const member: MemberInput | undefined = payload.member
      ? { ...payload.member, isAdmin: payload.actorIsAdmin ?? payload.member.isAdmin }
      : payload.actorIsAdmin ? { displayName: 'Admin', isAdmin: true } : undefined;
    return this.service.joinRoomById(
      payload.roomId,
      payload.userId,
      payload.password,
      member,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.LEAVE_ROOM })
  leaveRoom(@Payload() payload: { roomId: string; userId: string }) {
    return this.service.leaveRoom(payload.roomId, payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.CLOSE_ROOM })
  closeRoom(@Payload() payload: { roomId: string; reason: RoomCloseReason }) {
    return this.service.closeRoom(payload.roomId, payload.reason);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.IS_HOST })
  isHost(@Payload() payload: { roomId: string; userId: string }) {
    return this.service.isHost(payload.roomId, payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.GET_ROOM_STATE })
  getRoomState(@Payload() payload: { roomId: string }) {
    return this.service.getRoomState(payload.roomId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.GET_ROOM_SUMMARY })
  getRoomSummary(@Payload() payload: { roomId: string }) {
    return this.service.getRoomSummary(payload.roomId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.GET_ROOM_FOR_USER })
  getRoomIdForUser(@Payload() payload: { userId: string }) {
    return this.service.getRoomIdForUser(payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.GET_MEMBER_NAME })
  getMemberDisplayName(@Payload() payload: { roomId: string; userId: string }) {
    return this.service.getMemberDisplayName(payload.roomId, payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.LIST_ACTIVE_ROOMS })
  listActiveRooms(@Payload() payload: ListActiveRoomsQuery) {
    return this.service.listActiveRooms(payload);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.SYNC_VIDEO })
  syncVideo(
    @Payload()
    payload: {
      roomId: string;
      userId: string;
      state: { isPlaying: boolean; currentTime: number };
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.syncVideo(
      payload.roomId,
      payload.userId,
      payload.state,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.SEND_MESSAGE })
  sendMessage(
    @Payload()
    payload: {
      roomId: string;
      userId: string;
      displayName: string;
      text: string;
    },
  ) {
    return this.service.sendMessage(
      payload.roomId,
      payload.userId,
      payload.displayName,
      payload.text,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.PUSH_SYSTEM_MESSAGE })
  pushSystemMessage(@Payload() payload: { roomId: string; text: string }) {
    return this.service.pushSystemMessage(payload.roomId, payload.text);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.SEND_REACTION })
  sendReaction(@Payload() payload: { userId: string; emoji: string }) {
    return this.service.sendReaction(payload.userId, payload.emoji);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.MUTE_MEMBER })
  muteMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
      durationSec?: number;
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.muteMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
      payload.durationSec,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.UNMUTE_MEMBER })
  unmuteMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.unmuteMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.IS_MUTED })
  isMuted(@Payload() payload: { roomId: string; userId: string }) {
    return this.service.isMuted(payload.roomId, payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.KICK_MEMBER })
  kickMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.kickMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.BAN_MEMBER })
  banMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
      durationSec?: number;
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.banMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
      payload.durationSec,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.UNBAN_MEMBER })
  unbanMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.unbanMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.IS_BANNED })
  isBanned(@Payload() payload: { roomId: string; userId: string }) {
    return this.service.isBanned(payload.roomId, payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.GET_QUEUE })
  getQueue(@Payload() payload: { roomId: string }) {
    return this.service.getQueue(payload.roomId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ENQUEUE_VIDEO })
  enqueueVideo(
    @Payload()
    payload: {
      roomId: string;
      hostId: string;
      item: Omit<QueueItem, 'addedBy' | 'addedAt'>;
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.enqueueVideo(payload.roomId, payload.hostId, payload.item, payload.actorIsAdmin);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.REMOVE_FROM_QUEUE })
  removeFromQueue(
    @Payload() payload: { roomId: string; hostId: string; index: number; actorIsAdmin?: boolean },
  ) {
    return this.service.removeFromQueue(
      payload.roomId,
      payload.hostId,
      payload.index,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.REORDER_QUEUE })
  reorderQueue(
    @Payload()
    payload: { roomId: string; hostId: string; from: number; to: number; actorIsAdmin?: boolean },
  ) {
    return this.service.reorderQueue(
      payload.roomId,
      payload.hostId,
      payload.from,
      payload.to,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.PLAY_NEXT })
  playNext(@Payload() payload: { roomId: string; hostId: string; actorIsAdmin?: boolean }) {
    return this.service.playNext(payload.roomId, payload.hostId, payload.actorIsAdmin);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.PLAY_NOW })
  playNow(
    @Payload()
    payload: {
      roomId: string;
      hostId: string;
      item: Omit<QueueItem, 'addedBy' | 'addedAt'>;
      actorIsAdmin?: boolean;
    },
  ) {
    return this.service.playNow(payload.roomId, payload.hostId, payload.item, payload.actorIsAdmin);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.HANDLE_VIDEO_END })
  handleVideoEnd(
    @Payload()
    payload: { roomId: string; hostId: string; videoId?: string; actorIsAdmin?: boolean },
  ) {
    return this.service.handleVideoEnd(
      payload.roomId,
      payload.hostId,
      payload.videoId,
      payload.actorIsAdmin,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_LIST_ALL_ROOMS })
  adminListAllRooms(
    @Payload()
    payload: { limit: number; offset: number; search?: string; videoId?: string },
  ) {
    return this.service.adminListAllRooms(payload);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_GET_ROOM_DETAILS })
  adminGetRoomDetails(@Payload() payload: { roomId: string }) {
    return this.service.adminGetRoomDetails(payload.roomId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_CLOSE_ROOM })
  adminCloseRoom(
    @Payload()
    payload: { roomId: string; adminId: string; reason?: string },
  ) {
    return this.service.adminCloseRoom(payload.roomId, payload.adminId, payload.reason);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_KICK_MEMBER })
  adminKickMember(
    @Payload()
    payload: { roomId: string; adminId: string; targetId: string },
  ) {
    return this.service.adminKickMember(payload.roomId, payload.adminId, payload.targetId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_GET_STATS })
  adminGetStats() {
    return this.service.adminGetStats();
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_BAN_USER })
  adminBanUser(
    @Payload()
    payload: { userId: string; durationSec?: number },
  ) {
    return this.service.adminBanUserFromWatchParty(payload.userId, payload.durationSec);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_UNBAN_USER })
  adminUnbanUser(@Payload() payload: { userId: string }) {
    return this.service.adminUnbanUserFromWatchParty(payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.ADMIN_IS_GLOBALLY_BANNED })
  adminIsGloballyBanned(@Payload() payload: { userId: string }) {
    return this.service.adminIsGloballyBanned(payload.userId);
  }
}
