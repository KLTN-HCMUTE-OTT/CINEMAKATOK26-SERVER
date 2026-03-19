import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { JwtPayload } from '@app/common/constants/jwt-payload';
import { ERROR_CODE } from '@app/common/constants/global.constants';
import { USER_STATUS } from '@app/common/enums/global.enum';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_PUBLIC_KEY'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    // If it is a refresh token, it should not be used for authentication
    if (payload.isRefresh) {
      throw new UnauthorizedException({
        message: 'Invalid token type.',
        code: ERROR_CODE.INVALID_TOKEN,
      });
    }

    try {
      const user = await firstValueFrom(this.userService.getById(payload.sub));
      if (!user) {
        throw new UnauthorizedException({
          message: 'User not found.',
          code: ERROR_CODE.USER_NOT_FOUND,
        });
      }

      if (user.status === USER_STATUS.DEACTIVATED) {
        throw new UnauthorizedException({
          message: 'Your account has been deactivated.',
          code: ERROR_CODE.ACCOUNT_DEACTIVATED,
        });
      }

      if (user.status === USER_STATUS.BANNED) {
        throw new UnauthorizedException({
          message: 'Your account has been banned.',
          code: ERROR_CODE.USER_BANNED,
        });
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException({
        message: 'Authentication failed.',
        code: ERROR_CODE.UNAUTHORIZED,
      });
    }
  }
}
