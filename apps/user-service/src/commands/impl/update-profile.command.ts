import { IsString, IsUUID } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';
import { UpdateProfileRequest } from '@app/common/dtos/user/profile.dto';

export class UpdateProfileCommand extends BaseCommand {
  @IsUUID()
  userId: string;

  updateDto: UpdateProfileRequest;
}
