import { Injectable, Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

import {
  AuthRequest,
  ForgotPasswordRequest,
  LoginResponse,
  OTPResponse,
  RegisterRequest,
  RegisterWithOtpRequest,
  ResetPasswordRequest,
  TokenRequest,
  TokenResponse,
  UserPayload,
} from '@app/common/dtos/auth/auth.dto';
import { OTP_PURPOSE } from '@app/common/enums/global.enum';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  UserBannedError,
  UserNotFoundError,
} from '@app/common/exceptions';
import { PasswordHash } from '@app/common/utils/hash';

import { EmailService } from './email.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Internal Helpers ────────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<UserPayload> {
    try {
      return await firstValueFrom<UserPayload>(
        this.userClient.send({ cmd: 'user.find-by-email' }, { email }),
      );
    } catch (error: unknown) {
      const rpcError = error as { code?: string };
      if (rpcError?.code === 'USER_NOT_FOUND') throw new UserNotFoundError();
      throw error;
    }
  }

  private async assertEmailNotTaken(email: string): Promise<void> {
    try {
      await this.findByEmail(email);
      throw new EmailAlreadyExistsError();
    } catch (error) {
      if (!(error instanceof UserNotFoundError)) throw error;
    }
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  async login(authRequest: AuthRequest): Promise<LoginResponse> {
    const user = await this.findByEmail(authRequest.email);

    this.validatePassword(authRequest.password, user.password);
    this.validateUserStatus(user);

    const token = await this.generateAndSaveTokens(user.id);

    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      token,
    };
  }

  async refresh(token: TokenRequest): Promise<TokenResponse> {
    return this.tokenService.refresh(token);
  }

  async logout(userId: string): Promise<void> {
    await this.tokenService.removeRefreshToken(userId);
  }

  // ─── Registration ─────────────────────────────────────────────────────────────

  async sendRegisterOtp(dto: RegisterRequest): Promise<OTPResponse> {
    await this.assertEmailNotTaken(dto.email);

    const otp = await this.otpService.generateOtp(
      dto.email,
      OTP_PURPOSE.REGISTRATION,
    );
    await this.emailService.sendOtpEmail(dto.email, otp, 'REGISTRATION');

    return new OTPResponse(5);
  }

  async registerVerify(dto: RegisterWithOtpRequest): Promise<any> {
    await this.assertEmailNotTaken(dto.email);

    await this.otpService.verifyOtp(
      dto.email,
      dto.otp,
      OTP_PURPOSE.REGISTRATION,
    );

    const hashedPassword = PasswordHash.hashPassword(dto.password);

    await firstValueFrom(
      this.userClient.send(
        { cmd: 'user.create' },
        {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          isEmailVerified: true,
          ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
          ...(dto.gender && { gender: dto.gender }),
        },
      ),
    );
    return true;
  }

  async resendRegisterOtp(email: string): Promise<OTPResponse> {
    await this.assertEmailNotTaken(email);

    const otp = await this.otpService.generateOtp(
      email,
      OTP_PURPOSE.REGISTRATION,
    );
    await this.emailService.sendOtpEmail(email, otp, 'REGISTRATION');

    return new OTPResponse(5);
  }

  // ─── Forgot / Reset Password ──────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordRequest): Promise<OTPResponse> {
    console.log('service',dto)
    await this.findByEmail(dto.email);

    const otp = await this.otpService.generateOtp(
      dto.email,
      OTP_PURPOSE.FORGOT_PASSWORD,
    );
    await this.emailService.sendOtpEmail(dto.email, otp, 'FORGOT_PASSWORD');

    return new OTPResponse(5);
  }

  async resetPassword(dto: ResetPasswordRequest): Promise<boolean> {
    const user = await this.findByEmail(dto.email);

    await this.otpService.verifyOtp(
      dto.email,
      dto.otp,
      OTP_PURPOSE.FORGOT_PASSWORD,
    );

    const hashedPassword = PasswordHash.hashPassword(dto.newPassword);
    await firstValueFrom<boolean>(
      this.userClient.send(
        { cmd: 'user.update-password' },
        { userId: user.id, hashedPassword },
      ),
    );

    await this.otpService.cleanupExpiredOtpsByEmail(dto.email);
    await this.otpService.cleanupExpiredOtps();

    this.emailService.sendPasswordResetConfirmation(dto.email).catch(() => {
      // Non-blocking — password was already changed successfully
    });
    return true;
  }

  async resendForgotPasswordOtp(email: string): Promise<OTPResponse> {
    await this.findByEmail(email);

    const otp = await this.otpService.generateOtp(
      email,
      OTP_PURPOSE.FORGOT_PASSWORD,
    );
    await this.emailService.sendOtpEmail(email, otp, 'FORGOT_PASSWORD');

    return new OTPResponse(5);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private validatePassword(inputPassword: string, hashPassword?: string): void {
    if (
      !hashPassword ||
      !PasswordHash.comparePassword(inputPassword, hashPassword)
    ) {
      throw new InvalidCredentialsError('Invalid password');
    }
  }

  private validateUserStatus(user: UserPayload): void {
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
