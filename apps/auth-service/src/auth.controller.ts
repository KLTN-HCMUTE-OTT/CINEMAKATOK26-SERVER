import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthRequest, RegisterRequest } from '@app/common/dtos/auth/auth.dto';
import { AuthService } from './services/auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authServiceService: AuthService) {}

  @MessagePattern({ cmd: 'auth.login' })
  async login(@Payload() payload: AuthRequest) {
    return this.authServiceService.login(payload);
  }

  @MessagePattern({ cmd: 'auth.register' })
  async register(@Payload() data: RegisterRequest) {
    return this.authServiceService.register(data);
  }

  @MessagePattern({ cmd: 'auth.refresh' })
  async refresh(@Payload() data: { refreshToken: string }) {
    return this.authServiceService.refresh(data);
  }

  @MessagePattern({ cmd: 'auth.logout' })
  async logout(@Payload() data: { userId: string }) {
    return this.authServiceService.logout(data.userId);
  }
}
