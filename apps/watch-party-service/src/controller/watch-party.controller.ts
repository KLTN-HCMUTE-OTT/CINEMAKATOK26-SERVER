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
    },
  ) {
    return this.service.joinRoomById(
      payload.roomId,
      payload.userId,
      payload.password,
      payload.member,
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
    },
  ) {
    return this.service.syncVideo(
      payload.roomId,
      payload.userId,
      payload.state,
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
    },
  ) {
    return this.service.muteMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
      payload.durationSec,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.UNMUTE_MEMBER })
  unmuteMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
    },
  ) {
    return this.service.unmuteMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.IS_MUTED })
  isMuted(@Payload() payload: { roomId: string; userId: string }) {
    return this.service.isMuted(payload.roomId, payload.userId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.BAN_MEMBER })
  banMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
      durationSec?: number;
    },
  ) {
    return this.service.banMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
      payload.durationSec,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.UNBAN_MEMBER })
  unbanMember(
    @Payload()
    payload: {
      roomId: string;
      actorId: string;
      targetId: string;
    },
  ) {
    return this.service.unbanMember(
      payload.roomId,
      payload.actorId,
      payload.targetId,
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
    },
  ) {
    return this.service.enqueueVideo(payload.roomId, payload.hostId, payload.item);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.REMOVE_FROM_QUEUE })
  removeFromQueue(
    @Payload() payload: { roomId: string; hostId: string; index: number },
  ) {
    return this.service.removeFromQueue(
      payload.roomId,
      payload.hostId,
      payload.index,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.REORDER_QUEUE })
  reorderQueue(
    @Payload()
    payload: { roomId: string; hostId: string; from: number; to: number },
  ) {
    return this.service.reorderQueue(
      payload.roomId,
      payload.hostId,
      payload.from,
      payload.to,
    );
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.PLAY_NEXT })
  playNext(@Payload() payload: { roomId: string; hostId: string }) {
    return this.service.playNext(payload.roomId, payload.hostId);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.PLAY_NOW })
  playNow(
    @Payload()
    payload: {
      roomId: string;
      hostId: string;
      item: Omit<QueueItem, 'addedBy' | 'addedAt'>;
    },
  ) {
    return this.service.playNow(payload.roomId, payload.hostId, payload.item);
  }

  @MessagePattern({ cmd: WATCH_PARTY_CMD.HANDLE_VIDEO_END })
  handleVideoEnd(
    @Payload()
    payload: { roomId: string; hostId: string; videoId?: string },
  ) {
    return this.service.handleVideoEnd(
      payload.roomId,
      payload.hostId,
      payload.videoId,
    );
  }
}
