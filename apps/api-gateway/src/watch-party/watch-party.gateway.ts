import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { WatchPartyError } from '@app/common/exceptions';
import { RoomCloseReason } from '@app/common/dtos/watch-party';

import {
  ChatMessagePayloadDto,
  EnqueueVideoPayloadDto,
  JoinRoomPayloadDto,
  ModerationActionPayloadDto,
  ModerationTargetPayloadDto,
  PlayNowPayloadDto,
  ReactionPayloadDto,
  RemoveFromQueuePayloadDto,
  ReorderQueuePayloadDto,
  VideoEndPayloadDto,
  VideoSyncPayloadDto,
} from '../../../../libs/common/src/dtos/watch-party/watch-party.dto';
import { LOG_ACTION } from '@app/common/enums/log.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WATCH_PARTY_EVENTS } from './watch-party.constants';
import { WatchPartyService } from './watch-party.service';
import { WatchPartySocketUser, WsJwtGuard } from './ws-jwt.guard';

interface SocketData {
  user?: WatchPartySocketUser;
  roomId?: string;
}

const wsValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: false,
  exceptionFactory: (errors) =>
    new WsException({
      code: 'INVALID_BODY',
      message: 'Invalid payload',
      details: errors,
    }),
});

@WebSocketGateway({
  namespace: '/watch-party',
  cors: { origin: true, credentials: true },
})
export class WatchPartyGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WatchPartyGateway.name);
  private readonly hostGraceTimers = new Map<string, NodeJS.Timeout>();
  private readonly hostGracePeriodMs: number;
  private readonly idleGraceTimers = new Map<string, NodeJS.Timeout>();
  private readonly idleGracePeriodMs: number;

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly service: WatchPartyService,
    private readonly wsJwtGuard: WsJwtGuard,
    private readonly auditLog: AuditLogService,
    config: ConfigService,
  ) {
    this.hostGracePeriodMs =
      Number(config.get('WATCH_PARTY_HOST_GRACE_PERIOD', 30)) * 1000;
    this.idleGracePeriodMs =
      Number(config.get('WATCH_PARTY_IDLE_GRACE', 30)) * 1000;
  }

  afterInit(server: Namespace) {
    this.logger.log('Watch-party gateway initialised');
    server.use((socket, next) => {
      try {
        this.wsJwtGuard.authenticate(socket);
        next();
      } catch (err) {
        next(err as Error);
      }
    });
  }

  async handleConnection(client: Socket) {
    const user = this.getUser(client);
    if (!user) {
      client.disconnect(true);
      return;
    }
    this.logger.debug(`WS connected: user=${user.id} socket=${client.id}`);

    // If user has an active room, they may be reconnecting as host within grace period
    const previousRoom = await this.service.getRoomIdForUser(user.id);
    if (previousRoom) {
      const isHost = await this.service.isHost(previousRoom, user.id);
      if (isHost && this.hostGraceTimers.has(previousRoom)) {
        const t = this.hostGraceTimers.get(previousRoom);
        if (t) clearTimeout(t);
        this.hostGraceTimers.delete(previousRoom);
        this.logger.log(
          `Host ${user.id} reconnected in time; grace cancelled for ${previousRoom}`,
        );
      }
    }
  }

  async handleDisconnect(client: Socket) {
    const user = this.getUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!user || !roomId) return;

    const isHost = await this.service.isHost(roomId, user.id);
    if (isHost) {
      this.scheduleHostGrace(roomId, user.id);
      return;
    }

    await this.service.leaveRoom(roomId, user.id).catch(() => undefined);
    this.server
      .to(roomId)
      .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_LEFT, { userId: user.id });
    this.auditLog.logWatchPartyAction({
      userId: user.id,
      action: LOG_ACTION.LEAVE_WATCH_PARTY_ROOM,
      roomId,
    });
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomPayloadDto,
  ) {
    const user = this.requireUser(client);
    try {
      const state = await this.service.joinRoomById(
        body.roomId,
        user.id,
        body.password,
        { displayName: user.displayName, avatarUrl: user.avatarUrl, isAdmin: user.isAdmin },
      );
      (client.data as SocketData).roomId = body.roomId;
      await client.join(body.roomId);

      this.server
        .to(body.roomId)
        .except(client.id)
        .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_JOINED, {
          member: state.members.find((m) => m.userId === user.id),
        });

      client.emit(WATCH_PARTY_EVENTS.ROOM_STATE, state);
      this.auditLog.logWatchPartyAction({
        userId: user.id,
        action: LOG_ACTION.JOIN_WATCH_PARTY_ROOM,
        roomId: body.roomId,
      });
      return { ok: true };
    } catch (err) {
      const normalized = this.normalizeError(err);
      if (normalized.code === 'BANNED') {
        client.emit(WATCH_PARTY_EVENTS.ROOM_KICKED, { reason: 'banned', until: null });
      } else {
        client.emit(WATCH_PARTY_EVENTS.ERROR, normalized);
      }
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:leave')
  async onLeave(@ConnectedSocket() client: Socket) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: true };

    const isHost = await this.service.isHost(roomId, user.id);
    if (isHost) {
      await this.closeRoomAndBroadcast(roomId, 'host_closed', user.id);
    } else {
      await this.service.leaveRoom(roomId, user.id);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_LEFT, { userId: user.id });
      await client.leave(roomId);
      (client.data as SocketData).roomId = undefined;
      this.auditLog.logWatchPartyAction({
        userId: user.id,
        action: LOG_ACTION.LEAVE_WATCH_PARTY_ROOM,
        roomId,
      });
    }
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('video:sync')
  async onVideoSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: VideoSyncPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const next = await this.service.syncVideo(roomId, user.id, body, user.isAdmin);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.VIDEO_SYNC_UPDATE, {
          ...next,
          serverTime: Date.now(),
        });
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('chat:message')
  async onChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ChatMessagePayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const message = await this.service.sendMessage(
        roomId,
        user.id,
        user.displayName,
        body.text,
      );
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.CHAT_NEW_MESSAGE, { message });
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('member:mute')
  async onMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ModerationActionPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const entry = await this.service.muteMember(
        roomId,
        user.id,
        body.userId,
        body.durationSec,
        user.isAdmin,
      );
      const targetName = await this.getDisplayName(roomId, body.userId);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_MUTED, entry);
      await this.emitSystemMessage(
        roomId,
        `${targetName} đã bị tắt chat${this.formatDuration(entry.until)}.`,
      );
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('member:unmute')
  async onUnmute(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ModerationTargetPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      await this.service.unmuteMember(roomId, user.id, body.userId, user.isAdmin);
      const targetName = await this.getDisplayName(roomId, body.userId);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_UNMUTED, {
          userId: body.userId,
        });
      await this.emitSystemMessage(
        roomId,
        `${targetName} đã được mở chat trở lại.`,
      );
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('member:kick')
  async onKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ModerationTargetPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const targetName = await this.getDisplayName(roomId, body.userId);
      await this.service.kickMember(roomId, user.id, body.userId, user.isAdmin);

      const namespace = this.server;
      const sockets = await namespace.in(roomId).fetchSockets();
      for (const s of sockets) {
        const sUser = (s.data as SocketData)?.user;
        if (sUser?.id === body.userId) {
          s.emit(WATCH_PARTY_EVENTS.ROOM_KICKED, { reason: 'kicked', until: 0 });
          (s.data as SocketData).roomId = undefined;
          s.leave(roomId);
        }
      }

      namespace
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_LEFT, { userId: body.userId });
      await this.emitSystemMessage(
        roomId,
        `${targetName} đã bị đuổi khỏi phòng.`,
      );
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('member:ban')
  async onBan(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ModerationActionPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const targetName = await this.getDisplayName(roomId, body.userId);
      const entry = await this.service.banMember(
        roomId,
        user.id,
        body.userId,
        body.durationSec,
        user.isAdmin,
      );

      const namespace = this.server;
      const sockets = await namespace.in(roomId).fetchSockets();
      for (const s of sockets) {
        const sUser = (s.data as SocketData)?.user;
        if (sUser?.id === body.userId) {
          s.emit(WATCH_PARTY_EVENTS.ROOM_KICKED, {
            reason: 'banned',
            until: entry.until,
            banReason: body.reason,
          });
          (s.data as SocketData).roomId = undefined;
          s.leave(roomId);
        }
      }

      namespace.to(roomId).emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_BANNED, entry);
      namespace
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_LEFT, { userId: body.userId });
      await this.emitSystemMessage(
        roomId,
        `${targetName} đã bị đuổi khỏi phòng${this.formatDuration(entry.until)}.`,
      );
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('member:unban')
  async onUnban(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ModerationTargetPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      await this.service.unbanMember(roomId, user.id, body.userId, user.isAdmin);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_UNBANNED, {
          userId: body.userId,
        });
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('reaction:send')
  async onReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ReactionPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const reaction = await this.service.sendReaction(user.id, body.emoji);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.REACTION_BROADCAST, reaction);
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('queue:add')
  async onQueueAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: EnqueueVideoPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const queue = await this.service.enqueueVideo(roomId, user.id, {
        videoId: body.videoId,
        title: body.title,
        thumbnailUrl: body.thumbnailUrl,
        durationSec: body.durationSec,
      }, user.isAdmin);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.QUEUE_UPDATED, { queue });
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('queue:remove')
  async onQueueRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RemoveFromQueuePayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const queue = await this.service.removeFromQueue(
        roomId,
        user.id,
        body.index,
        user.isAdmin,
      );
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.QUEUE_UPDATED, { queue });
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('queue:reorder')
  async onQueueReorder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ReorderQueuePayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const queue = await this.service.reorderQueue(
        roomId,
        user.id,
        body.from,
        body.to,
        user.isAdmin,
      );
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.QUEUE_UPDATED, { queue });
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('video:play-now')
  async onPlayNow(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PlayNowPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      this.cancelIdleGrace(roomId);
      const result = await this.service.playNow(roomId, user.id, {
        videoId: body.videoId,
        title: body.title,
        thumbnailUrl: body.thumbnailUrl,
        durationSec: body.durationSec,
      }, user.isAdmin);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.VIDEO_CHANGED, {
          videoState: result.videoState,
          queue: result.queue,
          serverTime: Date.now(),
        });
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('video:play-next')
  async onPlayNext(@ConnectedSocket() client: Socket) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      this.cancelIdleGrace(roomId);
      await this.advanceQueue(roomId, user.id, user.isAdmin);
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(wsValidationPipe)
  @SubscribeMessage('video:end')
  async onVideoEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: VideoEndPayloadDto,
  ) {
    const user = this.requireUser(client);
    const roomId = (client.data as SocketData)?.roomId;
    if (!roomId) return { ok: false };
    try {
      const result = await this.service.handleVideoEnd(
        roomId,
        user.id,
        body.videoId,
        user.isAdmin,
      );
      if (result.nextItem) {
        this.server
            .to(roomId)
          .emit(WATCH_PARTY_EVENTS.VIDEO_CHANGED, {
            videoState: result.videoState,
            queue: result.queue,
            serverTime: Date.now(),
          });
      } else {
        this.server
            .to(roomId)
          .emit(WATCH_PARTY_EVENTS.VIDEO_QUEUE_EMPTY, {});
        this.scheduleIdleGrace(roomId);
      }
      return { ok: true };
    } catch (err) {
      this.emitError(client, err);
      return { ok: false };
    }
  }

  async closeRoomAndBroadcast(roomId: string, reason: RoomCloseReason, hostId?: string, customReason?: string) {
    this.cancelIdleGrace(roomId);
    const namespace = this.server;
    namespace.to(roomId).emit(WATCH_PARTY_EVENTS.ROOM_CLOSED, { reason, customReason });
    const sockets = await namespace.in(roomId).fetchSockets();
    for (const s of sockets) {
      (s.data as SocketData).roomId = undefined;
      s.leave(roomId);
    }
    await this.service.closeRoom(roomId, reason);
    if (hostId) {
      this.auditLog.logWatchPartyAction({
        userId: hostId,
        action: LOG_ACTION.CLOSE_WATCH_PARTY_ROOM,
        roomId,
        metadata: { reason },
      });
    }
  }

  async adminKickMemberAndBroadcast(roomId: string, targetId: string): Promise<void> {
    await this.service.adminKickMember(roomId, 'admin', targetId);
    const namespace = this.server;
    const sockets = await namespace.in(roomId).fetchSockets();
    for (const s of sockets) {
      const socketUser = (s.data as SocketData)?.user;
      if (socketUser?.id === targetId) {
        s.emit(WATCH_PARTY_EVENTS.ROOM_KICKED, { userId: targetId });
        (s.data as SocketData).roomId = undefined;
        s.leave(roomId);
      }
    }
    namespace.to(roomId).emit(WATCH_PARTY_EVENTS.ROOM_MEMBER_LEFT, { userId: targetId });
  }

  private async advanceQueue(roomId: string, hostId: string, actorIsAdmin = false): Promise<void> {
    const result = await this.service.playNext(roomId, hostId, actorIsAdmin);
    if (result.nextItem) {
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.VIDEO_CHANGED, {
          videoState: result.videoState,
          queue: result.queue,
          serverTime: Date.now(),
        });
    } else {
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.VIDEO_QUEUE_EMPTY, {});
      this.scheduleIdleGrace(roomId);
    }
  }

  private scheduleIdleGrace(roomId: string) {
    if (this.idleGraceTimers.has(roomId)) return;
    this.logger.log(
      `Queue empty in ${roomId}; idle grace ${this.idleGracePeriodMs}ms`,
    );
    const t = setTimeout(() => {
      this.idleGraceTimers.delete(roomId);
      this.closeRoomAndBroadcast(roomId, 'idle').catch((err) =>
        this.logger.error(
          `Failed to idle-close room ${roomId}: ${(err as Error).message}`,
        ),
      );
    }, this.idleGracePeriodMs);
    this.idleGraceTimers.set(roomId, t);
  }

  private cancelIdleGrace(roomId: string) {
    const t = this.idleGraceTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      this.idleGraceTimers.delete(roomId);
    }
  }

  private scheduleHostGrace(roomId: string, hostId: string) {
    if (this.hostGraceTimers.has(roomId)) return;
    this.logger.log(
      `Host ${hostId} disconnected from ${roomId}; grace ${this.hostGracePeriodMs}ms`,
    );
    const t = setTimeout(() => {
      this.hostGraceTimers.delete(roomId);
      this.closeRoomAndBroadcast(roomId, 'host_left', hostId).catch((err) =>
        this.logger.error(
          `Failed to auto-close room ${roomId}: ${(err as Error).message}`,
        ),
      );
    }, this.hostGracePeriodMs);
    this.hostGraceTimers.set(roomId, t);
  }

  private getUser(client: Socket): WatchPartySocketUser | undefined {
    return (client.data as SocketData)?.user;
  }

  private requireUser(client: Socket): WatchPartySocketUser {
    const user = this.getUser(client);
    if (!user)
      throw new WsException({ code: 'UNAUTHORIZED', message: 'Auth required' });
    return user;
  }

  private async getDisplayName(roomId: string, userId: string) {
    const name = await this.service.getMemberDisplayName(roomId, userId);
    return name ?? `user-${userId.slice(0, 6)}`;
  }

  private async emitSystemMessage(roomId: string, text: string) {
    try {
      const message = await this.service.pushSystemMessage(roomId, text);
      this.server
        .to(roomId)
        .emit(WATCH_PARTY_EVENTS.CHAT_NEW_MESSAGE, { message });
    } catch (err) {
      this.logger.warn(
        `Failed to push system message: ${(err as Error).message}`,
      );
    }
  }

  private formatDuration(until: number | null): string {
    if (until === null) return ' vĩnh viễn';
    const seconds = Math.max(0, Math.round((until - Date.now()) / 1000));
    if (seconds < 60) return ` ${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return ` ${minutes} phút`;
    const hours = Math.round(minutes / 60);
    return ` ${hours} giờ`;
  }

  private emitError(client: Socket, err: unknown) {
    const payload = this.normalizeError(err);
    if (payload.code === 'INTERNAL_ERROR') {
      this.logger.error(
        `Gateway error: ${(err as Error)?.message ?? String(err)}`,
        (err as Error)?.stack,
      );
    }
    client.emit(WATCH_PARTY_EVENTS.ERROR, payload);
  }

  private normalizeError(err: unknown): { code: string; message: string } {
    if (err instanceof WatchPartyError) {
      return { code: err.code, message: err.message };
    }
    if (err instanceof RpcException) {
      const rpc = err.getError();
      if (rpc && typeof rpc === 'object') {
        const r = rpc as Record<string, unknown>;
        const code = typeof r.code === 'string' ? r.code : 'INTERNAL_ERROR';
        const message =
          typeof r.message === 'string' ? r.message : 'Internal error';
        return { code, message };
      }
    }
    if (err && typeof err === 'object') {
      const r = err as Record<string, unknown>;
      if (typeof r.code === 'string' && typeof r.message === 'string') {
        return { code: r.code, message: r.message };
      }
    }
    return { code: 'INTERNAL_ERROR', message: 'Internal error' };
  }
}
