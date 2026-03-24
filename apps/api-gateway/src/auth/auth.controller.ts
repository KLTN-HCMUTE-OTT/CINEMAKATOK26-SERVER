import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public, UserSession } from '@app/common/decorators';
import {
  AuthRequest,
  LoginResponse,
  RegisterRequest,
  OTPResponse,
  RegisterWithOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TokenRequest,
  TokenResponse,
  SocialLoginRequest,
} from '@app/common/dtos/auth/auth.dto';
import { ApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';
import { firstValueFrom, Observable } from 'rxjs';
import { plainToInstance } from 'class-transformer';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: AuthRequest })
  @ApiOkResponse({
    description: 'Login success',
    type: ApiResponseDto(LoginResponse),
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  async login(@Body() authRequest: AuthRequest) {
    const result = await firstValueFrom<LoginResponse>(
      this.authService.login(authRequest) as Observable<LoginResponse>,
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(LoginResponse, result, {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Public()
  @Post('/social-login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Social login with Google/Facebook',
    description:
      'Login or register using Google/Facebook OAuth. Automatically creates account if user does not exist.',
  })
  @ApiBody({ type: SocialLoginRequest })
  @ApiResponse({
    status: 200,
    description: 'Social login successful',
    type: ApiResponseDto(LoginResponse),
  })
  @ApiResponse({ status: 400, description: 'Invalid social access token' })
  async socialLogin(@Body() socialLoginDto: SocialLoginRequest) {
    const result = await firstValueFrom<LoginResponse>(
      this.authService.socialLogin(socialLoginDto) as Observable<LoginResponse>,
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(LoginResponse, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Social login successful',
    });
  }

  @Public()
  @Post('register')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send OTP for registration',
    description:
      'Sends a 6-digit OTP to user email for account verification during registration. OTP expires in 5 minutes.',
  })
  @ApiBody({ type: RegisterRequest })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: ApiResponseDto(OTPResponse),
  })
  @ApiResponse({
    status: 400,
    description: 'Email already exists or invalid data',
  })
  async register(@Body() registerDto: RegisterRequest) {
    const optResponse = await firstValueFrom<OTPResponse>(
      this.authService.register(registerDto) as Observable<OTPResponse>,
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(OTPResponse, optResponse, {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Public()
  @Post('/register/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify OTP and complete registration',
    description: `Verifies the 6-digit OTP sent to the user's email and completes the registration process. If verification is successful, the user account is created and activated.`,
  })
  @ApiBody({ type: RegisterWithOtpRequest })
  @ApiResponse({
    status: 200,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP or expired OTP',
  })
  async registerVerify(@Body() verifyOtpDto: RegisterWithOtpRequest) {
    await firstValueFrom<any>(
      this.authService.registerVerify(verifyOtpDto) as Observable<any>,
    );

    return ResponseBuilder.createResponse({
      data: null,
      message: 'User registered successfully. Please login to continue.',
    });
  }

  @Public()
  @Post('register/resend-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resend OTP for registration',
    description:
      'Resends a new 6-digit OTP to user email for registration. Previous OTPs will be invalidated.',
  })
  @ApiQuery({
    name: 'email',
    description: 'User email address to resend OTP',
    example: 'user@example.com',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'New OTP sent successfully',
    type: ApiResponseDto(OTPResponse),
  })
  async resendRegisterOtp(@Query('email') email: string) {
    const optResponse = await firstValueFrom<OTPResponse>(
      this.authService.resendRegisterOtp(email) as Observable<OTPResponse>,
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(OTPResponse, optResponse, {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Post('/refresh')
  @Public()
  @ApiBody({ type: TokenRequest })
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse({
    description: 'Refresh token success',
    type: ApiResponseDto(TokenResponse),
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() body: TokenRequest) {
    const result = await firstValueFrom<TokenResponse>(
      this.authService.refresh(body) as Observable<TokenResponse>,
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(TokenResponse, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Refresh token success',
    });
  }

  @Delete('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and invalidate token' })
  async logout(@UserSession('id') userId: string) {
    await firstValueFrom(this.authService.logout(userId));
    return ResponseBuilder.createResponse({
      data: null,
      message: 'Logged out successfully',
    });
  }

  @Public()
  @Post('/forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send OTP for password reset',
    description:
      "Sends a 6-digit OTP to the user's email for password reset. OTP expires in 5 minutes.",
  })
  @ApiBody({ type: ForgotPasswordRequest })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: ApiResponseDto(OTPResponse),
  })
  @ApiResponse({ status: 400, description: 'Failed to send OTP' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordRequest) {
    const result = await firstValueFrom<OTPResponse>(
      this.authService.forgotPassword(
        forgotPasswordDto,
      ) as Observable<OTPResponse>,
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(OTPResponse, result, {
        excludeExtraneousValues: true,
      }),
      message: 'OTP has been sent to your email',
    });
  }

  @Public()
  @Post('/forgot-password/reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset password with OTP',
    description:
      'Resets user password using verified OTP. The OTP will be marked as used after successful reset.',
  })
  @ApiBody({ type: ResetPasswordRequest })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP or password requirements not met',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordRequest) {
    await firstValueFrom(this.authService.resetPassword(resetPasswordDto));
    return ResponseBuilder.createResponse({
      data: null,
      message: 'Password reset successfully. Please login to continue.',
    });
  }

  @Public()
  @Post('/forgot-password/resend-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resend OTP',
    description:
      "Resends OTP to user's email. Previous OTPs will be invalidated.",
  })
  @ApiQuery({
    name: 'email',
    description: 'User email address',
    example: 'user@example.com',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'OTP resent successfully',
    type: ApiResponseDto(OTPResponse),
  })
  @ApiResponse({ status: 400, description: 'Failed to resend OTP' })
  async resendOtp(@Query('email') email: string) {
    const result = await firstValueFrom<OTPResponse>(
      this.authService.resendForgotPasswordOtp(
        email,
      ) as Observable<OTPResponse>,
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(OTPResponse, result, {
        excludeExtraneousValues: true,
      }),
      message: 'New OTP has been sent to your email',
    });
  }
}
