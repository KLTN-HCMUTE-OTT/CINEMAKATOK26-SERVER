import { Expose } from 'class-transformer';
import {
  IsDate,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { GENDER } from '@app/common/enums/global.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class ProfileResponse extends BaseEntityDto {
  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  @IsString()
  @Expose()
  name: string;
  @ApiProperty({
    description: 'User email',
    example: 'john@example.com',
  })
  @IsEmail()
  @Expose()
  email: string;
  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  @Expose()
  avatar: string;
  @ApiProperty({
    description: 'Authentication provider',
    example: 'google',
  })
  @IsString()
  @Expose()
  provider: string;
  @ApiProperty({
    description: 'Is email verified',
    example: true,
  })
  @Expose()
  isEmailVerified: boolean;
  @ApiProperty({
    description: 'User gender',
    example: GENDER.MALE,
    enum: GENDER,
  })
  @IsEnum(GENDER)
  @Expose()
  gender: GENDER;
  @ApiProperty({
    description: 'User date of birth',
    example: '1990-01-01',
  })
  @IsDateString()
  @Expose()
  dateOfBirth: Date | null;
  @ApiProperty({
    description: 'User address',
    example: '123 Main St, Anytown, USA',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  address: string | null;
  @ApiProperty({
    description: 'User phone number',
    example: '0384912345',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  phoneNumber: string | null;
}

export class UpdateProfileRequest extends OmitType(ProfileResponse, [
  'id',
  'createdAt',
  'updatedAt',
  'email',
  'provider',
  'isEmailVerified',
]) {}

export class ChangePasswordRequest {
  @ApiProperty({
    description: 'Current password',
    example: 'currentPassword123',
  })
  @IsString({ message: 'Current password is required' })
  @IsNotEmpty({ message: 'Current password cannot be empty' })
  @Expose()
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewPassword123!',
    minLength: 8,
  })
  @IsString({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character',
  })
  @Expose()
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password',
    example: 'NewPassword123!',
  })
  @IsString({ message: 'Password confirmation is required' })
  @IsNotEmpty({ message: 'Password confirmation cannot be empty' })
  @Expose()
  confirmPassword: string;
}

export class UpdateAvatarRequest {
  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;
}

export class UploadAvatarResponse {
  @ApiProperty({
    description: 'New avatar URL',
    example: 'https://example.com/uploads/avatars/user-123-1234567890.jpg',
  })
  @Expose()
  avatarUrl: string;

  constructor(avatarUrl: string) {
    this.avatarUrl = avatarUrl;
  }
}
