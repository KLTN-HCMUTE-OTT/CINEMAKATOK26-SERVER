import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, IsAdminGuard } from '@app/common/guards';

import { UserSession } from '@app/common/decorators';
import { ApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';

import {
  AdminBanUserDto,
  AdminCloseRoomDto,
  AdminListRoomsQueryDto,
  CreateRoomRequest,
  CreateRoomResponse,
  InviteLookupResponse,
  RoomListQueryDto,
  RoomListResponse,
  WatchPartyStatsResponse,
} from '../../../../libs/common/src/dtos/watch-party/watch-party.dto';
import { LOG_ACTION } from '@app/common/enums/log.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WatchPartyService } from './watch-party.service';
import { WatchPartyGateway } from './watch-party.gateway';

@ApiTags('Watch Party')
@ApiBearerAuth('access-token')
@Controller('watch-party')
export class WatchPartyController {
  constructor(
    private readonly service: WatchPartyService,
    private readonly gateway: WatchPartyGateway,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post('rooms')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new watch-party room' })
  @ApiOkResponse({ type: ApiResponseDto(CreateRoomResponse) })
  async createRoom(
    @UserSession() user: { id: string; fullName?: string; avatarUrl?: string },
    @Body() body: CreateRoomRequest,
  ) {
    const result = await this.service.createRoom(user.id, body, {
      displayName: user.fullName ?? `user-${user.id.slice(0, 6)}`,
      avatarUrl: user.avatarUrl,
    });
    this.auditLog.logWatchPartyAction({
      userId: user.id,
      action: LOG_ACTION.CREATE_WATCH_PARTY_ROOM,
      roomId: result.roomId,
      metadata: { title: body.title, videoId: body.videoId, inviteCode: result.inviteCode },
    });
    return ResponseBuilder.createResponse({
      data: result,
      message: 'Room created',
      statusCode: HttpStatus.CREATED,
    });
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List active watch-party rooms (newest first)' })
  @ApiOkResponse({ type: ApiResponseDto(RoomListResponse) })
  async listRooms(@Query() query: RoomListQueryDto) {
    const data = await this.service.listActiveRooms({
      scope: query.scope ?? 'public',
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      videoId: query.videoId,
    });
    return ResponseBuilder.createResponse({ data });
  }

  @Get('rooms/invite/:code')
  @ApiOperation({ summary: 'Look up a room by invite code' })
  @ApiOkResponse({ type: ApiResponseDto(InviteLookupResponse) })
  async lookupInvite(@Param('code') code: string) {
    const data = await this.service.lookupInvite(code);
    return ResponseBuilder.createResponse({ data });
  }

  @Delete('rooms/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Host closes the room' })
  async closeRoom(
    @UserSession('id') userId: string,
    @Param('id') roomId: string,
  ) {
    const isHost = await this.service.isHost(roomId, userId);
    if (!isHost) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED',
        message: 'Only the host can close the room',
      });
    }
    await this.gateway.closeRoomAndBroadcast(roomId, 'host_closed');
    this.auditLog.logWatchPartyAction({
      userId,
      action: LOG_ACTION.CLOSE_WATCH_PARTY_ROOM,
      roomId,
      metadata: { reason: 'host_closed' },
    });
    return ResponseBuilder.createResponse({
      data: null,
      message: 'Room closed',
    });
  }

  @Get('my-rooms')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the active room for the current user' })
  async myRoom(@UserSession('id') userId: string) {
    const roomId = await this.service.getRoomIdForUser(userId);
    if (!roomId) {
      return ResponseBuilder.createResponse({ data: null });
    }
    const summary = await this.service.getRoomSummary(roomId);
    return ResponseBuilder.createResponse({ data: summary });
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  @Get('admin/rooms')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all watch-party rooms (admin)' })
  @ApiOkResponse({ type: ApiResponseDto(RoomListResponse) })
  async adminListRooms(@Query() query: AdminListRoomsQueryDto) {
    const data = await this.service.adminListAllRooms({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      search: query.search,
      videoId: query.videoId,
    });
    return ResponseBuilder.createResponse({ data });
  }

  @Get('admin/rooms/:id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get watch-party room details (admin)' })
  async adminGetRoomDetails(@Param('id') roomId: string) {
    const data = await this.service.adminGetRoomDetails(roomId);
    return ResponseBuilder.createResponse({ data });
  }

  @Delete('admin/rooms/:id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Force-close a watch-party room (admin)' })
  async adminCloseRoom(
    @UserSession('id') adminId: string,
    @Param('id') roomId: string,
    @Body() body: AdminCloseRoomDto,
  ) {
    await this.gateway.closeRoomAndBroadcast(roomId, 'admin_closed');
    this.auditLog.logWatchPartyAction({
      userId: adminId,
      action: LOG_ACTION.ADMIN_CLOSE_WATCH_PARTY_ROOM,
      roomId,
      metadata: { reason: body.reason ?? 'admin_closed' },
    });
    return ResponseBuilder.createResponse({ data: null, message: 'Room closed by admin' });
  }

  @Delete('admin/rooms/:id/members/:userId')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Kick a member from a watch-party room (admin)' })
  async adminKickMember(
    @UserSession('id') adminId: string,
    @Param('id') roomId: string,
    @Param('userId') targetId: string,
  ) {
    await this.gateway.adminKickMemberAndBroadcast(roomId, targetId);
    this.auditLog.logWatchPartyAction({
      userId: adminId,
      action: LOG_ACTION.ADMIN_KICK_WATCH_PARTY_MEMBER,
      roomId,
      metadata: { targetUserId: targetId },
    });
    return ResponseBuilder.createResponse({ data: null, message: 'Member kicked by admin' });
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get watch-party system statistics (admin)' })
  @ApiOkResponse({ type: ApiResponseDto(WatchPartyStatsResponse) })
  async adminGetStats() {
    const data = await this.service.adminGetStats();
    return ResponseBuilder.createResponse({ data });
  }

  @Post('admin/users/:userId/ban')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Global-ban a user from Watch Party (admin)' })
  async adminBanUser(
    @UserSession('id') adminId: string,
    @Param('userId') targetUserId: string,
    @Body() body: AdminBanUserDto,
  ) {
    await this.service.adminBanUser(targetUserId, body.durationSec);
    this.auditLog.logWatchPartyAction({
      userId: adminId,
      action: LOG_ACTION.ADMIN_BAN_USER_FROM_WATCH_PARTY,
      roomId: targetUserId,
      metadata: { targetUserId, durationSec: body.durationSec, reason: body.reason },
    });
    return ResponseBuilder.createResponse({ data: null, message: 'User banned from Watch Party' });
  }

  @Delete('admin/users/:userId/ban')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Remove global Watch Party ban from a user (admin)' })
  async adminUnbanUser(
    @UserSession('id') adminId: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.service.adminUnbanUser(targetUserId);
    this.auditLog.logWatchPartyAction({
      userId: adminId,
      action: LOG_ACTION.ADMIN_UNBAN_USER_FROM_WATCH_PARTY,
      roomId: targetUserId,
      metadata: { targetUserId },
    });
    return ResponseBuilder.createResponse({ data: null, message: 'User unbanned from Watch Party' });
  }
}
