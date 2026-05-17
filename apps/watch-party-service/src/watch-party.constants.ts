export const WATCH_PARTY_REDIS = 'WATCH_PARTY_REDIS';

export const WP_KEYS = {
  room: (roomId: string) => `wp:room:${roomId}`,
  video: (roomId: string) => `wp:room:${roomId}:video`,
  members: (roomId: string) => `wp:room:${roomId}:members`,
  memberInfo: (roomId: string) => `wp:room:${roomId}:member-info`,
  chat: (roomId: string) => `wp:room:${roomId}:chat`,
  invite: (code: string) => `wp:invite:${code}`,
  userRoom: (userId: string) => `wp:user:${userId}:room`,
  bans: (roomId: string) => `wp:room:${roomId}:bans`,
  mutes: (roomId: string) => `wp:room:${roomId}:mutes`,
  queue: (roomId: string) => `wp:room:${roomId}:queue`,
  activeRooms: 'wp:rooms:active',
  publicRooms: 'wp:rooms:public',
};

export const SYSTEM_USER_ID = '__system__';
