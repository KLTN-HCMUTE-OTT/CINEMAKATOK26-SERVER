import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { catchRpcError } from '@app/common/exceptions';
import { UpdateProfileRequest, ChangePasswordRequest, UpdateAvatarRequest } from '@app/common/dtos/user/profile.dto';
import { PaginationQueryDto } from '@app/common/utils/dto';
import { BanUserDto } from '@app/common/dtos/user/user.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  getProfile(userId: string): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.getProfile' }, { userId })
      .pipe(catchRpcError());
  }

  updateProfile(userId: string, updateDto: UpdateProfileRequest): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.updateProfile' }, { userId, updateDto })
      .pipe(catchRpcError());
  }

  getById(id: string): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.getById' }, { id })
      .pipe(catchRpcError());
  }

  changePassword(userId: string, changePasswordDto: ChangePasswordRequest): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.changePassword' }, { userId, changePasswordDto })
      .pipe(catchRpcError());
  }

  updateAvatar(userId: string, updateAvatarDto: UpdateAvatarRequest): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.updateAvatar' }, { userId, updateAvatarDto })
      .pipe(catchRpcError());
  }

  deleteAvatar(userId: string): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.deleteAvatar' }, { userId })
      .pipe(catchRpcError());
  }

  getAllUsers(query: PaginationQueryDto, search?: string): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.getAllUsers' }, { query, search })
      .pipe(catchRpcError());
  }

  banUser(userId: string, banUserDto: BanUserDto): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.banUser' }, { userId, banUserRequest: banUserDto })
      .pipe(catchRpcError());
  }

  unbanUser(userId: string): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.unbanUser' }, { userId })
      .pipe(catchRpcError());
  }

  updateUser(userId: string, data: Record<string, any>): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.updateUser' }, { userId, updateUserRequest: data })
      .pipe(catchRpcError());
  }

  createUser(data: Record<string, any>): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.createUser' }, data)
      .pipe(catchRpcError());
  }

  deleteUser(userId: string): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.deleteUser' }, { userId })
      .pipe(catchRpcError());
  }

  getUserDetail(userId: string): Observable<any> {
    return this.userClient
      .send({ cmd: 'user.getUserDetail' }, { userId })
      .pipe(catchRpcError());
  }

  getUsersByIds(ids: string[]): Observable<any[]> {
    return this.userClient
      .send({ cmd: 'user.getUsersByIds' }, { ids })
      .pipe(catchRpcError());
  }
}
