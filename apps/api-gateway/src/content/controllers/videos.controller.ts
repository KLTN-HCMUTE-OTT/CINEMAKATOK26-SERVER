import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { Public } from '@app/common/decorators/public.decorator';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';
import {
  PaginatedApiResponseDto,
  ResponseBuilder,
} from '@app/common/utils/dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import {
  CreateVideoDto,
  VideoDto,
  UpdateVideoDto,
} from '@app/common/dtos/content/video.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get videos list' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order for videos',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search videos by title',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all videos',
    type: PaginatedApiResponseDto(VideoDto),
  })
  async getVideos(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getVideos(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((video: any) =>
        plainToInstance(VideoDto, video, {
          excludeExtraneousValues: true,
        }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Videos retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get video detail by ID' })
  @ApiResponse({
    status: 200,
    description: 'Video detail retrieved successfully',
    type: VideoDto,
  })
  @ApiNotFoundResponse({ description: 'Video not found' })
  async getVideoById(@Param('id', new ParseUUIDPipe()) id: string) {
    const video = await firstValueFrom(this.contentService.getVideoById(id));

    return ResponseBuilder.createResponse({
      data: plainToInstance(VideoDto, video, {
        excludeExtraneousValues: true,
      }),
      message: 'Video retrieved successfully',
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Create video' })
  @ApiResponse({
    status: 201,
    description: 'Video created successfully',
    type: VideoDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async createVideo(@Body() body: CreateVideoDto) {
    const result = await firstValueFrom(this.contentService.createVideo(body));

    return ResponseBuilder.createResponse({
      data: plainToInstance(VideoDto, result, {
        excludeExtraneousValues: true,
      }),
      statusCode: 201,
      message: 'Video created successfully',
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Update video' })
  @ApiResponse({
    status: 200,
    description: 'Video updated successfully',
    type: VideoDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Video not found' })
  async updateVideo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateVideoDto,
  ) {
    const result = await firstValueFrom(
      this.contentService.updateVideo(id, body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(VideoDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Video updated successfully',
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Delete video' })
  @ApiResponse({
    status: 200,
    description: 'Video deleted successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Video not found' })
  async deleteVideo(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.contentService.deleteVideo(id);

    return ResponseBuilder.createResponse({
      data: null,
      message: 'Video deleted successfully',
    });
  }
}
