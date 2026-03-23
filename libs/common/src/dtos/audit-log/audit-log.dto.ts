import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class AuditLogDto extends BaseEntityDto {
  @ApiProperty({
    description: 'ID of the user who performed the action',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description:
      'Session ID to group actions into transactions for recommendation engine',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @Expose()
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    description: 'Action performed',
    example: LOG_ACTION.PLAY_MOVIE,
  })
  @Expose()
  @IsEnum(LOG_ACTION)
  action: LOG_ACTION;

  @ApiProperty({
    description: 'Type of resource the action was performed on',
    example: RESOURCE_TYPE.MOVIE,
    required: false,
  })
  @Expose()
  @IsOptional()
  @IsEnum(RESOURCE_TYPE)
  resourceType: RESOURCE_TYPE;

  @ApiProperty({
    description: 'ID of the resource the action was performed on',
    example: '550e8400-e29b-41d4-a716-446655440002',
    required: false,
  })
  @Expose()
  @IsOptional()
  @IsUUID()
  resourceId: string;

  @ApiProperty({
    description:
      'Signal weight for recommendation engine (2=strong, 1=medium, -1=negative, 0=ignored)',
    example: 2,
  })
  @Expose()
  @IsNumber()
  signalWeight: number;

  @ApiProperty({
    description: 'Action-specific extra data',
    example: { watchDuration: 3420, completionRate: 0.85 },
    required: false,
  })
  @Expose()
  @IsOptional()
  metadata: Record<string, any>;
}

export class CreateAuditLogDto extends OmitType(AuditLogDto, [
  'id',
  'createdAt',
  'updatedAt',
] as const) {}

export class AuditLogVideo {
  @ApiProperty({
    description: 'ID of the video',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsNotEmpty()
  @IsUUID()
  videoId: string;
}

export class RecentActivityDto extends BaseEntityDto {
  @ApiProperty({
    description: 'ID of the user who performed the action',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Name of the user who performed the action',
    example: 'John Doe',
  })
  @Expose()
  userName: string;

  @ApiProperty({
    description: 'Action performed',
    example: LOG_ACTION.USER_LOGIN,
  })
  @Expose()
  action: LOG_ACTION;

  @ApiProperty({
    description: 'Description of the action',
    example: 'User logged in to the system',
  })
  @Expose()
  description: string;
}
