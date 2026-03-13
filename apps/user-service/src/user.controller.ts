import { Controller } from '@nestjs/common';
import { UserService } from './user.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern({ cmd: 'user.find-by-email' })
  async findByEmail(@Payload() payload: { email: string }) {
    return this.userService.findByEmail(payload.email);
  }
}
