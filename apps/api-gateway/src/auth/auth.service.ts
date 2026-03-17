import { AuthRequest, RegisterRequest, RegisterWithOtpRequest, ForgotPasswordRequest, ResetPasswordRequest, TokenRequest } from '@app/common/dtos/auth/auth.dto';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class AuthService {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  // ─── Auth ────────────────────────────────────────────────────────────────────

  login(payload: AuthRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.login' }, payload)
      .pipe(catchRpcError());
  }

  refresh(payload: TokenRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.refresh' }, payload)
      .pipe(catchRpcError());
  }

  logout(userId: string): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.logout' }, { userId })
      .pipe(catchRpcError());
  }

  // ─── Registration ─────────────────────────────────────────────────────────────

  register(payload: RegisterRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.send-register-otp' }, payload)
      .pipe(catchRpcError());
  }

  registerVerify(payload: RegisterWithOtpRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.register-verify' }, payload)
      .pipe(catchRpcError());
  }

  resendRegisterOtp(email: string): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.resend-register-otp' }, { email })
      .pipe(catchRpcError());
  }

  // ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────────]

  forgotPassword(payload: ForgotPasswordRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.forgot-password' }, payload)
      .pipe(catchRpcError());
  }

  resetPassword(payload: ResetPasswordRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.reset-password' }, payload)
      .pipe(catchRpcError());
  }

  resendForgotPasswordOtp(email: string): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.resend-forgot-password-otp' }, { email })
      .pipe(catchRpcError());
  }



}
