import { IsUUID, IsObject } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';
import type { ContentPreferences } from '@app/common/types/violence.types';

export class UpdateContentPreferencesCommand extends BaseCommand {
  @IsUUID()
  userId: string;

  @IsObject()
  preferences: Partial<ContentPreferences>;
}
