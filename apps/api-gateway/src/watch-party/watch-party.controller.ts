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
import { JwtAuthGuard } from '@app/common/guards';

import { UserSession } from '@app/common/decorators';
import { ApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';

import {
  CreateRoomRequest,
  CreateRoomResponse,
  InviteLookupResponse,
  RoomListQueryDto,
  RoomListResponse,
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
}
