import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ERROR_CODE } from '../constants/global.constants';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip role check on public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() specified — any authenticated user is allowed
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.userSession ?? request.user;

    if (!user) {
      throw new ForbiddenException({ code: ERROR_CODE.UNAUTHORIZED });
    }

    const hasRole = requiredRoles.some(
      (role) => user.role === role || user.roles?.includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenException({ code: ERROR_CODE.UNAUTHORIZED });
    }

    return true;
  }
}
