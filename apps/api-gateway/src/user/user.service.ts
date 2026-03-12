import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

@Injectable()
export class UserService {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  getProfile(userId: string): Observable<any> {
    return this.userClient.send({ cmd: 'user.getProfile' }, { userId });
  }

  updateProfile(userId: string, data: Record<string, any>): Observable<any> {
    return this.userClient.send({ cmd: 'user.updateProfile' }, { userId, ...data });
  }

  getById(id: string): Observable<any> {
    return this.userClient.send({ cmd: 'user.getById' }, { id });
  }
}
