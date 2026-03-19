import { Expose, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { GENDER } from '@app/common/enums/global.enum';
import { ApiProperty } from '@nestjs/swagger';

export interface UserPayload {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar: string | null;
  isAdmin: boolean;
  status: string;
  isBanned: boolean;
  bannedUntil?: Date;
  banReason?: string;
  providerId?: string;
  isEmailVerified?: boolean;
}

export class AuthRequest {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail()
  @Expose()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
  })
  @IsString()
  @Expose()
  password: string;
}

export class TokenResponse {
  @ApiProperty({
    description: 'Access token',
  })
  @Expose()
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token',
  })
  @Expose()
  refreshToken: string;

  constructor(a_token: string, r_token: string) {
    this.accessToken = a_token;
    this.refreshToken = r_token;
  }
}

export class TokenRequest {
  @ApiProperty({
    description: 'jwt token',
  })
  @IsString()
  @Expose()
  refreshToken: string;
}

// ============ Forgot Password DTOs ============
export class ForgotPasswordRequest {
  @ApiProperty({
    description: 'User email to send OTP',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Expose()
  email: string;
}

export class VerifyOtpRequest {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Expose()
  email: string;

  @ApiProperty({
    description: 'OTP code (6 digits)',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString({ message: 'OTP is required' })
  @MinLength(6, { message: 'OTP must be exactly 6 digits' })
  @MaxLength(6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  @Expose()
  @IsNotEmpty()
  otp: string;
}

export class ResetPasswordRequest {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Expose()
  email: string;

  @ApiProperty({
    description: 'OTP code (6 digits)',
    example: '123456',
  })
  @IsString({ message: 'OTP is required' })
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  @Expose()
  otp: string;

  @ApiProperty({
    description: 'New password',
    example: 'newPassword123!',
    minLength: 8,
  })
  @IsString({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character',
  })
  @Expose()
  newPassword: string;
}

export class OTPResponse {
  @ApiProperty({ example: 5 })
  @Expose()
  otpExpiryMinutes: number;

  constructor(otpExpiryMinutes: number = 5) {
    this.otpExpiryMinutes = otpExpiryMinutes;
  }
}

// ============ Registration DTOs ============
export class RegisterRequest {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @IsString({ message: 'Name is required' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Expose()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Password!123',
    minLength: 8,
  })
  @IsString({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character',
  })
  @Expose()
  password: string;

  @ApiProperty({
    description: 'User date of birth',
    example: '1990-01-01',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Date of birth must be a valid date string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date of birth must be in format YYYY-MM-DD' })
  @Expose()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'User gender',
    example: 'MALE',
    enum: GENDER,
    required: false,
  })
  @IsOptional()
  @IsEnum(GENDER, { message: 'Gender must be MALE, FEMALE, or OTHER' })
  @Expose()
  gender?: GENDER;
}

export class RegisterWithOtpRequest extends RegisterRequest {
  @ApiProperty({
    description: 'OTP code (6 digits)',
    example: '123456',
  })
  @IsString({ message: 'OTP is required' })
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  @Expose()
  otp: string;
}

// ============ SOCIAL LOGIN DTOs ============
export class SocialLoginRequest {
  @ApiProperty({
    description: 'Access token from social provider',
    example: 'ya29.a0ARrd...',
  })
  @IsString({ message: 'Access token is required' })
  @IsNotEmpty({ message: 'Access token cannot be empty' })
  @Expose()
  accessToken: string;
}

export class LoginResponse {
  @ApiProperty({
    description: 'User ID',
    example: 'user-123',
  })
  @Expose()
  id: string;
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @Expose()
  avatar: string | null;

  @ApiProperty({
    description: 'Is user an admin',
    example: true,
  })
  @Expose()
  isAdmin: boolean;

  @ApiProperty({
    description: 'Token details',
    type: TokenResponse,
  })
  @Expose()
  @ValidateNested()
  @Type(() => TokenResponse)
  token: TokenResponse;
}
