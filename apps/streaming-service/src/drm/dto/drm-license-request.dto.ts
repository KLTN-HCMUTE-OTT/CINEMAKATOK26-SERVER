import { IsArray, IsString, IsUUID, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DrmLicenseRequestDto {
  @ApiProperty({
    description: 'Array of Key IDs requested by the player (from manifest)',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  keyIds: string[];

  @ApiProperty({
    description: 'Content ID to check access tier against',
    format: 'uuid',
  })
  @IsUUID()
  contentId: string;
}
