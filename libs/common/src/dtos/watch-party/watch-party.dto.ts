import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomRequest {
  @ApiProperty({ description: 'Video ID for the watch party' })
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @ApiProperty({ description: 'Display title for the room', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional password to restrict joins',
    minLength: 4,
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Whether the room is discoverable in the public rooms list (default true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class CreateRoomResponse {
  @ApiProperty()
  roomId!: string;

  @ApiProperty()
  inviteCode!: string;
}

export class InviteLookupResponse {
  @ApiProperty()
  roomId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  videoId!: string;

  @ApiProperty()
  requirePassword!: boolean;

  @ApiProperty()
  memberCount!: number;

  @ApiProperty()
  maxMembers!: number;
}

export class JoinRoomPayloadDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  password?: string;
}

export class VideoSyncPayloadDto {
  @IsBoolean()
  isPlaying!: boolean;

  @IsNumber()
  @Min(0)
  currentTime!: number;
}

export class ChatMessagePayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;
}

export class ReactionPayloadDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 8)
  emoji!: string;
}

export class ModerationActionPayloadDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60 * 60 * 24)
  durationSec?: number;
}

export class ModerationTargetPayloadDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class RoomListQueryDto {
  @ApiPropertyOptional({ enum: ['public', 'all'], default: 'public' })
  @IsOptional()
  @IsIn(['public', 'all'])
  scope?: 'public' | 'all' = 'public';

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Filter by videoId' })
  @IsOptional()
  @IsString()
  videoId?: string;
}

export class RoomListItemDto {
  @ApiProperty()
  roomId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  videoId!: string;

  @ApiProperty()
  hostId!: string;

  @ApiProperty()
  requirePassword!: boolean;

  @ApiProperty()
  isPublic!: boolean;

  @ApiProperty()
  memberCount!: number;

  @ApiProperty()
  maxMembers!: number;

  @ApiProperty()
  createdAt!: number;
}

export class RoomListResponse {
  @ApiProperty({ type: [RoomListItemDto] })
  items!: RoomListItemDto[];

  @ApiProperty()
  total!: number;
}

export class EnqueueVideoPayloadDto {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number;
}

export class RemoveFromQueuePayloadDto {
  @IsInt()
  @Min(0)
  index!: number;
}

export class ReorderQueuePayloadDto {
  @IsInt()
  @Min(0)
  from!: number;

  @IsInt()
  @Min(0)
  to!: number;
}

export class PlayNowPayloadDto extends EnqueueVideoPayloadDto {}

export class VideoEndPayloadDto {
  @IsOptional()
  @IsString()
  videoId?: string;
}

export class AdminListRoomsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Search by title or hostId' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by videoId' })
  @IsOptional()
  @IsString()
  videoId?: string;
}

export class AdminCloseRoomDto {
  @ApiPropertyOptional({ description: 'Reason for closing the room' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminBanUserDto {
  @ApiPropertyOptional({ description: 'Duration in seconds (omit for permanent ban)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSec?: number;

  @ApiPropertyOptional({ description: 'Reason for the ban' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class WatchPartyStatsResponse {
  @ApiProperty()
  totalActiveRooms!: number;

  @ApiProperty()
  totalPublicRooms!: number;

  @ApiProperty()
  totalMembers!: number;
}
