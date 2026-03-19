import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import { BaseCommand } from '@app/common/base/base-command';
import { GENDER } from '@app/common/enums/global.enum';

export class CreateUserCommand extends BaseCommand {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  password: string;

  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  dateOfBirth?: Date;

  @IsEnum(GENDER)
  @IsOptional()
  gender?: GENDER;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;

  @IsString()
  @IsOptional()
  providerId?: string;
}
