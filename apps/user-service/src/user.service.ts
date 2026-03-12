import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityUser } from './entities/user.entity';
import { Repository } from 'typeorm';
import { ERROR_CODE } from '@app/common/constants/global.constants';
import { RpcException } from '@nestjs/microservices';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(EntityUser)
    private readonly userRepository: Repository<EntityUser>,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Retrieves a user entity by their email address.
   * Email is converted to lowercase before searching.
   *
   * @param email - The email address of the user to find
   * @returns A Promise that resolves to the EntityUser object
   * @throws RpcException - 404 Status if no user is found with the provided email
   */
  async findByEmail(email: string): Promise<EntityUser> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    // if (!user) {
    //   throw new RpcException({
    //     statusCode: 404,
    //     error: 'NotFoundException',
    //     code: ERROR_CODE.ENTITY_NOT_FOUND,
    //     message: 'Account with the provided email does not exist.',
    //   });
    // }
    if (!user) {
      throw new NotFoundException({
        code: ERROR_CODE.ENTITY_NOT_FOUND,
        message: 'Account with the provided email does not exist.',
      });
    }


    return user;
  }
}
