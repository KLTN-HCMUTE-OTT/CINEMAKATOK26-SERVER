import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityUser } from './entities/user.entity';
import { Repository } from 'typeorm';
import { UserNotFoundError } from '@app/common/exceptions';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  /**
   * Retrieves a user entity by their email address.
   * Email is converted to lowercase before searching.
   *
   * @param email - The email address of the user to find
   * @returns A Promise that resolves to the EntityUser object
   * @throws UserNotFoundError - if no user is found with the provided email
   */
  async findByEmail(email: string): Promise<EntityUser> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  }
}
