import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotFoundError, InvalidBodyError } from '@app/common/exceptions';

import { EntityUser } from '../../entities/user.entity';
import { UpdateProfileCommand } from '../impl/update-profile.command';

const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand, EntityUser> {
  constructor(
    @InjectRepository(EntityUser, 'user')
    private readonly userRepository: Repository<EntityUser>,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<EntityUser> {
    const { userId, updateDto } = command;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UserNotFoundError();

    if (updateDto.name) user.name = updateDto.name;
    if (updateDto.gender) user.gender = updateDto.gender;
    if (updateDto.address) user.address = updateDto.address;

    if (updateDto.dateOfBirth) {
      const dateOfBirth = new Date(updateDto.dateOfBirth);
      if (isNaN(dateOfBirth.getTime())) {
        throw new InvalidBodyError('Invalid date of birth format');
      }
      user.dateOfBirth = dateOfBirth;
    }

    if (updateDto.phoneNumber) {
      if (!PHONE_REGEX.test(updateDto.phoneNumber)) {
        throw new InvalidBodyError('Invalid phone number format');
      }
      user.phoneNumber = updateDto.phoneNumber;
    }

    if (updateDto.avatar) user.avatar = updateDto.avatar;

    return this.userRepository.save(user);
  }
}
