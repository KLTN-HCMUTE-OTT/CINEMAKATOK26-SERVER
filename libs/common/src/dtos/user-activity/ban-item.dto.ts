import { ApiProperty } from '@nestjs/swagger';
import { REPORT_TYPE } from '../../enums/global.enum';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsString, IsUUID } from 'class-validator';

export class BanItemDto {
  @ApiProperty({ enum: REPORT_TYPE, example: REPORT_TYPE.REVIEW })
  @IsEnum(REPORT_TYPE)
  @Expose()
  type: REPORT_TYPE;

  @ApiProperty({ example: '123' })
  @IsUUID()
  @Expose()
  id: string;
}