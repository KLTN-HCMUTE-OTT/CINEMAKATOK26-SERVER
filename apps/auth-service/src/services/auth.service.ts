import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { AuthRequest, TokenResponse, UserPayload, OTPResponse, RegisterRequest} from '@app/common/dtos/auth/auth.dto';
import { PasswordHash } from '@app/common/utils/hash';
import { ERROR_CODE } from '@app/common/constants/global.constants';
import { firstValueFrom } from 'rxjs';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { OTP_PURPOSE } from '@app/common/enums/global.enum';


@Injectable()
export class AuthService {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Fetches a user by their email address via TCP microservice call.
   * Rethrows RpcExceptions thrown by user-service to maintain trace context.
   */
  async findByEmail(email: string): Promise<UserPayload> {
    try {
      return await firstValueFrom<UserPayload>(
        this.userClient.send({ cmd: 'user.find-by-email' }, { email }),
      );
    } catch (error) {
      if (typeof error === 'object' && error !== null) {
         return Promise.reject(new RpcException(error));
      }
      return Promise.reject(new RpcException({
        statusCode: 500,
        message: 'Internal server error while fetching user',
        code: ERROR_CODE.UNEXPECTED_ERROR,
      }));
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

    const existingUser = await this.findByEmail(email);

    if(existingUser){
      throw new NotFoundException({
        code: ERROR_CODE.ALREADY_EXISTS,
        message: 'Account with the provided email already exists.',
      });
    }


    const otp = await this.otpService.generateOtp(email, OTP_PURPOSE.REGISTRATION);
    await this.emailService.sendOtpEmail(email, otp, 'REGISTRATION');

    return new OTPResponse(5);
  }

  async logout(userId: string): Promise<void> {
    await this.tokenService.removeRefreshToken(userId);
  }

  // --- Private Helper Methods ---

  private async validatePassword(inputPassword: string, hashPassword?: string): Promise<void> {
    if (!hashPassword || !PasswordHash.comparePassword(inputPassword, hashPassword)) {
      return Promise.reject(new RpcException({
        statusCode: 400,
        code: ERROR_CODE.INVALID_PASSWORD,
        message: 'Invalid password',
      }));
    }
  }

  private async validateUserStatus(user: UserPayload): Promise<void> {
    if (user.isBanned || user.status === 'BANNED') {
      const banMessage = user.bannedUntil
        ? `Your account has been banned until ${new Date(user.bannedUntil).toLocaleString()}. Reason: ${user.banReason || 'Violation of terms'}`
        : `Your account has been permanently banned. Reason: ${user.banReason || 'Violation of terms'}`;
      return Promise.reject(new RpcException({
        statusCode: 400,
        code: ERROR_CODE.BANNED,
        message: banMessage,
      }));
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
