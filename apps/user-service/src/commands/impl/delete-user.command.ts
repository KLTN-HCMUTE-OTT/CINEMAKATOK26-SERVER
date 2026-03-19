import { IsUUID } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';

export class DeleteUserCommand extends BaseCommand {
  @IsUUID()
  userId: string;
}
