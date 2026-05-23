export type RoomCloseReason =
  | 'host_left'
  | 'host_closed'
  | 'expired'
  | 'idle'
  | 'admin_closed';

export type WatchPartyErrorCode =
  | 'WRONG_PASSWORD'
  | 'ROOM_FULL'
  | 'NOT_FOUND'
  | 'ALREADY_IN_ROOM'
  | 'NOT_AUTHORIZED'
  | 'RATE_LIMITED'
  | 'MUTED'
  | 'BANNED'
  | 'QUEUE_FULL'
  | 'QUEUE_EMPTY'
  | 'INVALID_VIDEO'
  | 'INVALID_QUEUE_INDEX'
  | 'INTERNAL_ERROR';

export interface QueueItem {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  durationSec?: number;
  addedBy: string;
  addedAt: number;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: number;
  role?: 'host' | 'admin' | 'member';
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedAt: number;
  videoId: string;
  startedAt: number | null;
  status: 'playing' | 'awaiting_host';
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: number;
}

export interface Reaction {
  id: string;
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface RoomSummary {
  roomId: string;
  inviteCode: string;
  hostId: string;
  videoId: string;
  title: string;
  requirePassword: boolean;
  isPublic: boolean;
  maxMembers: number;
  memberCount: number;
  createdAt: number;
}

export interface RoomListItem {
  roomId: string;
  title: string;
  videoId: string;
  hostId: string;
  requirePassword: boolean;
  isPublic: boolean;
  memberCount: number;
  maxMembers: number;
  createdAt: number;
}

export interface RoomState {
  room: RoomSummary;
  members: RoomMember[];
  videoState: VideoState;
  recentMessages: ChatMessage[];
  queue: QueueItem[];
  mutedUserIds?: string[];
  bannedUserIds?: string[];
}

export interface CreateRoomResult {
  roomId: string;
  inviteCode: string;
}

export interface InviteLookupResult {
  roomId: string;
  title: string;
  videoId: string;
  requirePassword: boolean;
  memberCount: number;
  maxMembers: number;
}

export interface ModerationEntry {
  userId: string;
  until: number | null;
}

export interface MemberInput {
  displayName: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

export interface CreateRoomInput {
  videoId: string;
  title: string;
  password?: string;
  isPublic?: boolean;
}

export interface ListActiveRoomsQuery {
  scope: 'public' | 'all';
  limit: number;
  offset: number;
  videoId?: string;
}
