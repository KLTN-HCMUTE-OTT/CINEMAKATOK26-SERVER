import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export abstract class ApiResponse<T> {
  @ApiProperty({ example: 200 })
  statusCode: number;
  @ApiProperty({ example: 'Success' })
  message: string;
  @ApiProperty({ type: Object })
  data: T;
}

export const ApiResponseDto = <T>(dto: Type<T> | Type<T>[]) => {
  abstract class Host<T> extends ApiResponse<T> {
    @ApiProperty({
      type: () => (dto instanceof Array ? dto[0] : dto),
      isArray: dto instanceof Array,
    })
    declare data: T;
  }

  Object.defineProperty(Host, 'name', {
    writable: false,
    value: `${Array.isArray(dto) ? dto[0].name : dto.name}ResponseDto`,
  });
  return Host;
};
