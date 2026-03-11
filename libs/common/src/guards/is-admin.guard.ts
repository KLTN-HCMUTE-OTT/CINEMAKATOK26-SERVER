import { ForbiddenException, Injectable } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ADMIN_META_SKIP_AUTH, ERROR_CODE } from '../constants/global.constants';
import { IS_ADMIN_KEY } from '../decorators/admin-role.decorator';

@Injectable()
export class IsAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const adminRequired = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipAuth = this.reflector.getAllAndOverride<boolean>(ADMIN_META_SKIP_AUTH.SKIP_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!adminRequired || skipAuth) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user.isAdmin) throw new ForbiddenException({ code: ERROR_CODE.UNAUTHORIZED });
    return true;
  }
}
