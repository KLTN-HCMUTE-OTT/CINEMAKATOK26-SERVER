import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { ERROR_CODE } from '../constants/global.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException({
          message: 'Token is invalid or has expired.',
          code: ERROR_CODE.INVALID_TOKEN,
        })
      );
    }

    const request = context.switchToHttp().getRequest<Record<string, any>>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    request['userSession'] = user;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
