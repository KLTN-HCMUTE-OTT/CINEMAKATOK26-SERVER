import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { JwtPayload } from '@app/common/constants/jwt-payload';

export interface WatchPartySocketUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    return this.authenticate(client);
  }

  authenticate(client: Socket): boolean {
    const existing = (client.data as { user?: WatchPartySocketUser })?.user;
    if (existing?.id) return true;

    const token = this.extractToken(client);
    if (!token) {
      throw new WsException({ code: 'UNAUTHORIZED', message: 'Missing token' });
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        publicKey: this.config.getOrThrow<string>('JWT_PUBLIC_KEY'),
        algorithms: ['RS256'],
      });
      if (payload.isRefresh) {
        throw new WsException({
          code: 'INVALID_TOKEN',
          message: 'Refresh token cannot be used here',
        });
      }
      const user: WatchPartySocketUser = {
        id: payload.sub,
        displayName:
          (payload as JwtPayload & { displayName?: string }).displayName ??
          `user-${payload.sub.slice(0, 6)}`,
        avatarUrl: (payload as JwtPayload & { avatarUrl?: string }).avatarUrl,
      };
      (client.data as { user?: WatchPartySocketUser }).user = user;
      return true;
    } catch (err) {
      this.logger.debug(`WS auth failed: ${(err as Error).message}`);
      if (err instanceof WsException) throw err;
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;

    const header =
      client.handshake.headers.authorization ??
      client.handshake.headers.Authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;

    return null;
  }
}
