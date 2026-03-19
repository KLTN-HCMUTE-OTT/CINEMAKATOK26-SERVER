import { Expose, Type, plainToInstance } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { GENDER, USER_STATUS } from '@app/common/enums/global.enum';
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';

export class UserDto extends BaseEntityDto {
  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  @IsString()
  @Expose()
  name: string;

  @ApiProperty({
    description: 'User email',
    example: 'john.doe@example.com',
  })
  @IsString()
  @Expose()
  email: string;

  @ApiProperty({
    description: 'User admin status',
    example: true,
  })
  @IsBoolean()
  @Expose()
  isAdmin: boolean;

  @ApiProperty({
    description: 'User status',
    example: USER_STATUS.ACTIVATED,
    default: USER_STATUS.ACTIVATED,
    enum: USER_STATUS,
  })
  @IsEnum(USER_STATUS)
  @Expose()
  status: USER_STATUS;

  @ApiProperty({
    description: 'Is user banned',
    example: false,
  })
  @IsBoolean()
  @Expose()
  isBanned: boolean;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Expose()
  avatar?: string;

  @ApiProperty({
    description: 'Ban reason',
    example: 'Violating terms of service',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Expose()
  banReason?: string;

  @ApiProperty({
    description: 'Banned until date',
    example: '2025-11-20T12:00:00Z',
    required: false,
  })
  @IsDate()
  @IsOptional()
  @Expose()
  bannedUntil?: Date;
}

export class UserDetailDto extends UserDto {
  @ApiProperty({
    description: 'User date of birth',
    example: '1990-01-15',
    required: false,
  })
  @IsDate()
  @IsOptional()
  @Expose()
  @Type(() => Date)
  dateOfBirth?: Date;

  @ApiProperty({
    description: 'User gender',
    example: GENDER.MALE,
    enum: GENDER,
    required: false,
  })
  @IsEnum(GENDER)
  @IsOptional()
  @Expose()
  gender?: GENDER;

  @ApiProperty({
    description: 'User phone number',
    example: '+84912345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Expose()
  phoneNumber?: string;

  @ApiProperty({
    description: 'User address',
    example: '123 Main St',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Expose()
  address?: string;

  @ApiProperty({
    description: 'Email verified status',
    example: true,
  })
  @IsBoolean()
  @Expose()
  isEmailVerified: boolean;
}

export class UpdateUserDto extends PickType(UserDto, ['name', 'email', 'isAdmin', 'status']) {}

export class UpdateUserInfoDto extends PickType(UserDetailDto, [
  'name',
  'email',
  'phoneNumber',
  'avatar',
  'address',
  'dateOfBirth',
  'gender',
  'isAdmin',
]) {}

export class CreateUserDto extends OmitType(UserDto, [
  'status',
  'id',
  'createdAt',
  'updatedAt',
  'isBanned',
  'banReason',
  'bannedUntil',
]) {}

export class BanUserDto {
  @ApiProperty({
    description: 'Reason for banning user',
    example: 'Violating terms of service',
  })
  @IsString()
  banReason: string;

  @ApiProperty({
    description: 'Duration of ban in days',
    example: 7,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationDays: number;
}
