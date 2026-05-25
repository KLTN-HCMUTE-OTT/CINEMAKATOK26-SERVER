import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsUUID
} from 'class-validator';

export class ClearKeyLicenseRequestDto {
  @ApiProperty({
    type: [String],
    description:
      'Array of Key IDs (base64url or hex) from DASH manifest',
    example: [
      'ejQ2LWtleS1pZA',
      '1234567890abcdef1234567890abcdef',
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  kids: string[];

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Video ID',
  })
  @IsUUID()
  videoId: string;
}

export class ClearKeyKeyDto {
  @ApiProperty({
    example: 'oct',
    description: 'JSON Web Key type',
  })
  kty: string;

  @ApiProperty({
    example: 'base64url-encoded-key-id',
    description: 'Base64url encoded Key ID',
  })
  kid: string;

  @ApiProperty({
    example: 'base64url-encoded-content-key',
    description: 'Base64url encoded content decryption key',
  })
  k: string;
}

export class ClearKeyLicenseResponseDto {
  @ApiProperty({
    type: [ClearKeyKeyDto],
  })
  keys: ClearKeyKeyDto[];

  @ApiProperty({
    example: 'temporary',
  })
  type: string;
}