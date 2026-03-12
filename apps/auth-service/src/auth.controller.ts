import { Controller, Get, HttpException } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { AuthRequest, RegisterRequest } from '@app/common/dtos/auth/auth.dto';
import { AuthService } from './services/auth.service';
import { throwError } from 'rxjs';

@Controller()
export class AuthController {
  constructor(private readonly authServiceService: AuthService) {}

  @MessagePattern({ cmd: 'auth.login' })
  async login(@Payload() payload: AuthRequest) {
    try {
      return await this.authServiceService.login(payload);
    } catch (error) {
      if (error instanceof RpcException) {
        return throwError(() => error);
      }
      return throwError(() => new RpcException({
        statusCode: 500,
        message: 'Internal server error in auth-service',
      }));
    }
  }

  @MessagePattern({ cmd: 'auth.register' })
  async register(@Payload() data: RegisterRequest) {
    try {
      return await this.authServiceService.register(data);
    } catch (error) {
      if (error instanceof RpcException) {
        return throwError(() => error);
      }

      if(error instanceof HttpException){
        const payload = error.getResponse();
        return throwError(() => new RpcException(payload));
      }
      return throwError(() => new RpcException({
        statusCode: 500,
        message: 'Internal server error in auth-service',
      }));
    }
  }

  // @MessagePattern({ cmd: 'auth.refresh' })
  // async refresh(@Payload() data: any) {
  //   return this.authServiceService.refresh(data);
  // }

  // @MessagePattern({ cmd: 'auth.logout' })
  // async logout(@Payload() data: any) {
  //   return this.authServiceService.logout(data);
  // }
}
