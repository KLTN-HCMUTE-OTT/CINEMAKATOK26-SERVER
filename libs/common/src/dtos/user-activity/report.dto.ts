import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { REPORT_REASON, REPORT_STATUS, REPORT_TYPE } from '@app/common/enums/global.enum';
import { ApiProperty } from '@nestjs/swagger';

import { EpisodeReviewDto } from './episode.-review.dto';
import { ReviewDto } from './review.dto';

export class CreateReportDto {
  @ApiProperty({
    description: 'Type of the item being reported',
    enum: REPORT_TYPE,
    example: REPORT_TYPE.REVIEW,
  })
  @IsEnum(REPORT_TYPE)
  type: REPORT_TYPE;

  @ApiProperty({
    description: 'ID of the review or episode review being reported',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  targetId: string;

  @ApiProperty({
    description: 'Reason for reporting',
    enum: REPORT_REASON,
    example: REPORT_REASON.SPAM,
  })
  @IsEnum(REPORT_REASON)
  reason: REPORT_REASON;

  @ApiProperty({
    description: 'Additional details about the report',
    example: 'This review contains offensive language.',
    required: false,
  })
  @IsOptional()
  @IsString()
  details?: string;
}

export class ReportDto {
  @ApiProperty({
    description: 'ID of the report',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Type of the item being reported',
    enum: REPORT_TYPE,
  })
  @Expose()
  type: REPORT_TYPE;

  @ApiProperty({
    description: 'ID of the reported item',
  })
  @Expose()
  targetId: string;

  @ApiProperty({
    description: 'Reason for reporting',
    enum: REPORT_REASON,
  })
  @Expose()
  reason: REPORT_REASON;

  @ApiProperty({
    description: 'Additional details',
    nullable: true,
  })
  @Expose()
  details: string | null;

  @ApiProperty({
    description: 'Status of the report',
    enum: REPORT_STATUS,
  })
  @Expose()
  status: REPORT_STATUS;

  @ApiProperty({
    description: 'Reporter information',
    type: Object,
  })
  @Expose()
  @Transform(({ obj }) =>
    obj.reporter
      ? {
          id: obj.reporter.id,
          name: obj.reporter.name,
          email: obj.reporter.email,
        }
      : null,
  )
  reporter: {
    id: string;
    name: string;
    email: string;
  } | null;

  @ApiProperty({
    description: 'The reported review (if type is REVIEW)',
    type: ReviewDto,
    nullable: true,
  })
  @Expose()
  @Type(() => ReviewDto)
  review: ReviewDto | null;

  @ApiProperty({
    description: 'The reported episode review (if type is EPISODE_REVIEW)',
    type: EpisodeReviewDto,
    nullable: true,
  })
  @Expose()
  @Type(() => EpisodeReviewDto)
  episodeReview: EpisodeReviewDto | null;

  @ApiProperty({
    description: 'Creation date',
  })
  @Expose()
  createdAt: Date;
}
