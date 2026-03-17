import { Expose, Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

import { BaseEntityDto } from '@app/common/base/base-entity-dto';
import { GENDER } from '@app/common/enums/global.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class ActorDto extends BaseEntityDto {
  @ApiProperty({
    description: 'Name of the actor',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Birth date of the actor',
    example: '1990-01-01',
  })
  @IsNotEmpty()
  @IsDate()
  @Expose()
  dateOfBirth: Date;

  @ApiProperty({
    description: 'Gender of the actor',
    example: GENDER.MALE,
    default: GENDER.MALE,
    enum: GENDER,
  })
  @IsNotEmpty()
  @IsEnum(GENDER)
  @Expose()
  gender: GENDER;

  @ApiProperty({
    description: 'Biography of the actor',
    example: 'An accomplished actor known for his versatility.',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  bio: string;

  @ApiProperty({
    description: 'Profile picture of the actor',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  profilePicture: string;

  @ApiProperty({
    description: 'Nationality of the actor',
    example: 'American',
  })
  @IsString()
  @IsNotEmpty()
  @Expose()
  nationality: string;
}

// DTO riêng để hiển thị content trong actor detail
export class ActorContentDto {
  @ApiProperty({ description: 'Movie ID or TVSeries ID' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Content ID (metadata)' })
  @Expose()
  contentId: string;

  @ApiProperty({ description: 'Content type (MOVIE or TVSERIES)' })
  @Expose()
  type: string;

  @ApiProperty({ description: 'Content title' })
  @Expose()
  title: string;

  @ApiProperty({ description: 'Content description' })
  @Expose()
  description: string;

  @ApiProperty({ description: 'Content thumbnail URL' })
  @Expose()
  thumbnail: string;

  @ApiProperty({ description: 'Content release date' })
  @Expose()
  releaseDate: Date;

  @ApiProperty({ description: 'Duration of the content in minutes' })
  @Expose()
  duration: number;

  @ApiProperty({ description: 'Content rating' })
  @Expose()
  rating: number;

  @ApiProperty({ description: 'Actor role in this content', required: false })
  @Expose()
  @IsOptional()
  role?: string;
}

// DTO cho actor detail với danh sách contents
export class ActorDetailDto extends ActorDto {
  @ApiProperty({
    description: 'List of contents the actor appeared in',
    type: [ActorContentDto],
  })
  @ValidateNested({ each: true })
  @Type(() => ActorContentDto)
  @Expose()
  contents: ActorContentDto[];

  @ApiProperty({
    description: 'Total number of contents',
    example: 15,
  })
  @Expose()
  contentCount?: number;
}

export class CreateActorDto extends OmitType(ActorDto, ['id', 'createdAt', 'updatedAt']) {}
export class UpdateActorDto extends OmitType(ActorDto, ['createdAt', 'updatedAt']) {}
