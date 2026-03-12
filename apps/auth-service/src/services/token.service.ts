import { Injectable } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EntityRefreshToken } from "../entities/refresh-token.entity";
import { JwtPayload } from "@app/common/constants/jwt-payload";
import { ERROR_CODE } from "@app/common/constants/global.constants";
import { UnauthorizedException } from "@nestjs/common";
import { TokenResponse } from "@app/common/dtos/auth/auth.dto";
import { TokenRequest } from "@app/common/dtos/auth/auth.dto";

@Injectable()
export class TokenService {
    private readonly refreshExpiresTime = '7d';
    constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(EntityRefreshToken)
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
        const entity = this.tokenRepository.create({
            userId,
            token: refreshToken,
        });
        return this.tokenRepository.save(entity);
    }
    async checkRefreshToken(token: string) {
        try {
        const payload = this.jwtService.verify(token);
        if (!payload.isRefresh) {
            throw new Error();
        }
        const existedToken = await this.tokenRepository.findOneBy({
            userId: payload.sub,
            token: token,
        });
        if (!existedToken) {
            throw new Error();
        }
        return existedToken;
        } catch (err: any) {
        throw new UnauthorizedException({ code: ERROR_CODE.INVALID_TOKEN });
        }
    }

    async removeRefreshToken(userId: string) {
        await this.tokenRepository.delete({ userId });
    }

    async refresh(token: TokenRequest) {
        const existedToken = await this.checkRefreshToken(token.refreshToken);
        const { accessToken, refreshToken } = await this.generateTokens({
            sub: existedToken.userId,
        });
        await this.saveRefreshToken(refreshToken, existedToken.userId);
        await this.removeRefreshToken(token.refreshToken);
        return new TokenResponse(accessToken, refreshToken);
    }
  
}