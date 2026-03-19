import { IsUUID } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';

export class DeleteAvatarCommand extends BaseCommand {
  @IsUUID()
  userId: string;
}
