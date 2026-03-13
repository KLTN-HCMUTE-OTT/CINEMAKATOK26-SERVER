import { Injectable, Inject } from '@nestjs/common';
import {
  AuthRequest,
  TokenRequest,
  TokenResponse,
  UserPayload,
  OTPResponse,
  RegisterRequest,
} from '@app/common/dtos/auth/auth.dto';
import { PasswordHash } from '@app/common/utils/hash';
import { firstValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { OTP_PURPOSE } from '@app/common/enums/global.enum';
import {
  InvalidCredentialsError,
  UserBannedError,
  EmailAlreadyExistsError,
  UserNotFoundError,
} from '@app/common/exceptions';

@Injectable()
export class AuthService {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Fetches a user by their email address via TCP microservice call.
   * If the user service throws a domain error (e.g. USER_NOT_FOUND),
   * this will be forwarded via the proxy and re-evaluated here if needed.
   */
  async findByEmail(email: string): Promise<UserPayload> {
    try {
      return await firstValueFrom<UserPayload>(
        this.userClient.send({ cmd: 'user.find-by-email' }, { email }),
      );
    } catch (error: any) {
      if (error && error.code === 'USER_NOT_FOUND') {
        throw new UserNotFoundError();
      }
      throw error;
    }
  }

  /**
   * Authenticates a user and generates access/refresh tokens.
   */
  async login(authRequest: AuthRequest): Promise<any> {
    const user = await this.findByEmail(authRequest.email);

    await this.validatePassword(authRequest.password, user.password);
    await this.validateUserStatus(user);

    const tokens = await this.generateAndSaveTokens(user.id);

    // await this.auditLogService.log({
    //   action: LOG_ACTION.USER_LOGIN,
    //   userId: user.id,
    //   description: `User ${user.email} logged in`,
    // });

    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      token: tokens,
    };
  }

  async register(registerDto: RegisterRequest): Promise<any> {
    const { email } = registerDto;

    try {
      await this.findByEmail(email);
      // If we reach here, the user exists
      throw new EmailAlreadyExistsError();
    } catch (error) {
      // If it's literally a UserNotFoundError, that means the account doesn't exist.
      // That's exactly what we want for registration!
      if (!(error instanceof UserNotFoundError)) {
        throw error;
      }
    }

    const otp = await this.otpService.generateOtp(
      email,
      OTP_PURPOSE.REGISTRATION,
    );
    await this.emailService.sendOtpEmail(email, otp, 'REGISTRATION');

    return new OTPResponse(5);
  }

  async refresh(data: { refreshToken: string }): Promise<TokenResponse> {
    const tokenRequest = new TokenRequest();
    tokenRequest.refreshToken = data.refreshToken;
    return this.tokenService.refresh(tokenRequest);
  }

  async logout(userId: string): Promise<void> {
    await this.tokenService.removeRefreshToken(userId);
  }

  // --- Private Helper Methods ---

  private async validatePassword(
    inputPassword: string,
    hashPassword?: string,
  ): Promise<void> {
    if (
      !hashPassword ||
      !PasswordHash.comparePassword(inputPassword, hashPassword)
    ) {
      throw new InvalidCredentialsError('Invalid password');
    }
  }

  private async validateUserStatus(user: UserPayload): Promise<void> {
    if (user.isBanned || user.status === 'BANNED') {
      const banMessage = user.bannedUntil
        ? `Your account has been banned until ${new Date(user.bannedUntil).toLocaleString()}. Reason: ${user.banReason || 'Violation of terms'}`
        : `Your account has been permanently banned. Reason: ${user.banReason || 'Violation of terms'}`;
      throw new UserBannedError(banMessage);
    }
  }

  private async generateAndSaveTokens(userId: string): Promise<TokenResponse> {
    const { accessToken, refreshToken } = this.tokenService.generateTokens({
      sub: userId,
    });
    await this.tokenService.saveRefreshToken(userId, refreshToken);
    return new TokenResponse(accessToken, refreshToken);
  }
}
