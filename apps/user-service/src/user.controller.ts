import { Controller, Get, HttpException } from '@nestjs/common';
import { UserService } from './user.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getHello(): string {
    return this.userService.getHello();
  }

  @MessagePattern({ cmd: 'user.find-by-email' })
  async findByEmail(@Payload() payload: {email: string}) {
    try {
      return await this.userService.findByEmail(payload.email);
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
         message: 'Internal server error in user-service',
       }));
    }
  }
}
