export type JwtPayload = {
  sub: string;
  name?: string;
  avatar?: string;
  isRefresh?: boolean;
  isAdmin?: boolean;
};
