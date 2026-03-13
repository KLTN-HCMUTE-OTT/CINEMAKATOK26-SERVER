import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityRefreshToken } from '../entities/refresh-token.entity';
import { JwtPayload } from '@app/common/constants/jwt-payload';
import { InvalidTokenError } from '@app/common/exceptions';
import { TokenResponse, TokenRequest } from '@app/common/dtos/auth/auth.dto';

@Injectable()
export class TokenService {
  private readonly refreshExpiresTime = '7d';

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(EntityRefreshToken, 'auth')
    private readonly tokenRepository: Repository<EntityRefreshToken>,
  ) {}

  generateTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, isRefresh: true } as object,
      { expiresIn: this.refreshExpiresTime } as JwtSignOptions,
    );
    return { accessToken, refreshToken };
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    const entity = this.tokenRepository.create({ userId, token: refreshToken });
    return this.tokenRepository.save(entity);
  }

  async checkRefreshToken(token: string) {
    try {
      const payload = this.jwtService.verify<
        JwtPayload & { isRefresh?: boolean; sub: string }
      >(token);
      if (!payload.isRefresh) {
        throw new Error('Not a refresh token');
      }
      const existedToken = await this.tokenRepository.findOneBy({
        userId: payload.sub,
        token,
      });
      if (!existedToken) {
        throw new Error('Token not found');
      }
      return existedToken;
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      throw new InvalidTokenError();
    }
  }

  async removeRefreshToken(userId: string) {
    await this.tokenRepository.delete({ userId });
  }

  async refresh(token: TokenRequest) {
    const existedToken = await this.checkRefreshToken(token.refreshToken);
    // Invalidate old token before issuing new one (token rotation)
    await this.removeRefreshToken(existedToken.userId);
    const { accessToken, refreshToken } = this.generateTokens({
      sub: existedToken.userId,
    });
    await this.saveRefreshToken(existedToken.userId, refreshToken);
    return new TokenResponse(accessToken, refreshToken);
  }
}
