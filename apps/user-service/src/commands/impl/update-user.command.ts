import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';
import { GENDER } from '@app/common/enums/global.enum';

export class UpdateUserCommand extends BaseCommand {
  @IsUUID()
  userId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  dateOfBirth?: Date;

  @IsEnum(GENDER)
  @IsOptional()
  gender?: GENDER;

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}
