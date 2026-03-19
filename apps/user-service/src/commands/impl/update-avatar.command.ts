import { IsString, IsUrl, IsUUID } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';
import { UpdateAvatarRequest } from '@app/common/dtos/user/profile.dto';

export class UpdateAvatarCommand extends BaseCommand {
  @IsUUID()
  userId: string;

  @IsString()
  avatarUrl: string;
}
