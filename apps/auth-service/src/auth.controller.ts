import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  AuthRequest,
  ForgotPasswordRequest,
  RegisterRequest,
  RegisterWithOtpRequest,
  ResetPasswordRequest,
} from '@app/common/dtos/auth/auth.dto';

import { AuthService } from './services/auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Auth ────────────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'auth.login' })
  login(@Payload() payload: AuthRequest) {
    return this.authService.login(payload);
  }

  @MessagePattern({ cmd: 'auth.refresh' })
  refresh(@Payload() data: { refreshToken: string }) {
    return this.authService.refresh(data);
  }

  @MessagePattern({ cmd: 'auth.logout' })
  logout(@Payload() data: { userId: string }) {
    return this.authService.logout(data.userId);
  }

  // ─── Registration ─────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'auth.send-register-otp' })
  sendRegisterOtp(@Payload() data: RegisterRequest) {
    return this.authService.sendRegisterOtp(data);
  }

  @MessagePattern({ cmd: 'auth.register-with-otp' })
  registerWithOtp(@Payload() data: RegisterWithOtpRequest) {
    return this.authService.registerWithOtp(data);
  }

  @MessagePattern({ cmd: 'auth.resend-register-otp' })
  resendRegisterOtp(@Payload() data: { email: string }) {
    return this.authService.resendRegisterOtp(data.email);
  }

  // ─── Forgot / Reset Password ──────────────────────────────────────────────────

  @MessagePattern({ cmd: 'auth.forgot-password' })
  forgotPassword(@Payload() data: ForgotPasswordRequest) {
    return this.authService.forgotPassword(data);
  }

  @MessagePattern({ cmd: 'auth.reset-password' })
  resetPassword(@Payload() data: ResetPasswordRequest) {
    return this.authService.resetPassword(data);
  }

  @MessagePattern({ cmd: 'auth.resend-forgot-password-otp' })
  resendForgotPasswordOtp(@Payload() data: { email: string }) {
    return this.authService.resendForgotPasswordOtp(data.email);
  }
}
