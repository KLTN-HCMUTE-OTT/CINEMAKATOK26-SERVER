import { IsString, IsUUID } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';

export class UpdatePasswordCommand extends BaseCommand {
  @IsUUID()
  userId: string;

  @IsString()
  hashedPassword: string;
}
