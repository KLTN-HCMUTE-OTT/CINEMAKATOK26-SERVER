import { AuthRequest, RegisterRequest } from '@app/common/dtos/auth/auth.dto';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class AuthService {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  login(payload: AuthRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.login' }, payload)
      .pipe(catchRpcError());
  }

  register(payload: RegisterRequest): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.register' }, payload)
      .pipe(catchRpcError());
  }

  refresh(payload: Record<string, any>): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.refresh' }, payload)
      .pipe(catchRpcError());
  }

  logout(userId: string): Observable<any> {
    return this.authClient
      .send({ cmd: 'auth.logout' }, { userId })
      .pipe(catchRpcError());
  }
}
