import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Min } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';

export class BanUserCommand extends BaseCommand {
  @IsUUID()
  userId: string;

  @IsString()
  banReason: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationDays: number;
}
