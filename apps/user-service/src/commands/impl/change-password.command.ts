import { IsString, IsUUID } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';
import { ChangePasswordRequest } from '@app/common/dtos/user/profile.dto';

export class ChangePasswordCommand extends BaseCommand {
  @IsUUID()
  userId: string;

  changePasswordDto: ChangePasswordRequest;
}
