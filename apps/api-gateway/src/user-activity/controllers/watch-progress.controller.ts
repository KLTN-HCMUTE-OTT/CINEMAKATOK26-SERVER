import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { UserSession } from '@app/common/decorators';
import { JwtAuthGuard } from '@app/common/guards';
import {
  ApiResponseDto,
  PaginatedApiResponseDto,
  PaginationQueryDto,
  ResponseBuilder,
} from '@app/common/utils/dto';

import {
  CreateWatchProgressDto,
  UpdateWatchProgressDto,
  WatchProgressDto,
} from '@app/common/dtos/user-activity/watch-progress.dto';
import { WatchProgressService } from '../services/watch-progress.service';

@ApiTags('User Activity / Watch Progress')
@ApiBearerAuth('access-token')
@Controller('watch-progress')
export class WatchProgressController {
  constructor(private readonly watchProgressService: WatchProgressService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create or update watch progress for a video' })
  @ApiOkResponse({
    description: 'Watch progress updated successfully',
    type: ApiResponseDto(WatchProgressDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async createOrUpdateWatchProgress(
    @UserSession('id') userId: string,
    @Body() body: CreateWatchProgressDto,
  ) {
    const result = await firstValueFrom(
      this.watchProgressService.upsertWatchProgress(userId, body),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(WatchProgressDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Watch progress updated successfully',
    });
  }

  @Put(':videoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update watch progress for a specific video' })
  @ApiOkResponse({
    description: 'Watch progress updated successfully',
    type: ApiResponseDto(WatchProgressDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @ApiNotFoundResponse({ description: 'Watch progress not found' })
  async updateWatchProgress(
    @UserSession('id') userId: string,
    @Param('videoId') videoId: string,
    @Body() body: UpdateWatchProgressDto,
  ) {
    const result = await firstValueFrom(
      this.watchProgressService.updateWatchProgress(userId, videoId, body),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(WatchProgressDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Watch progress updated successfully',
    });
  }

  @Get('resume/:videoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get resume data to continue watching' })
  @ApiOkResponse({ description: 'Resume data retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Watch progress not found' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async getResumeData(
    @UserSession('id') userId: string,
    @Param('videoId') videoId: string,
  ) {
    const result = await firstValueFrom(
      this.watchProgressService.getResumeData(userId, videoId),
    );
    return ResponseBuilder.createResponse({
      data: result,
      message: 'Resume data retrieved successfully',
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all watch progress for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order',
    example: '{ "lastWatched": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by content title',
  })
  @ApiQuery({ name: 'isCompleted', required: false, type: Boolean })
  @ApiOkResponse({
    description: 'List of watch progress',
    type: PaginatedApiResponseDto(WatchProgressDto),
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async getAllWatchProgress(
    @UserSession('id') userId: string,
    @Query()
    query: PaginationQueryDto & { search?: string; isCompleted?: boolean },
  ) {
    const { data, total } = await firstValueFrom(
      this.watchProgressService.getWatchProgressByUser(userId, query),
    );

    const enrichedData = (data || []).map((item: any) => ({
      ...plainToInstance(WatchProgressDto, item, {
        excludeExtraneousValues: true,
      }),
      metadata: item.metadata || null,
      duration: item.duration || null,
      video: item.video
        ? {
            id: item.video.id,
            videoUrl: item.video.videoUrl,
            thumbnailUrl: item.video.thumbnailUrl,
            status: item.video.status,
            ownerType: item.video.ownerType,
            ownerId: item.video.ownerId,
          }
        : null,
    }));

    return ResponseBuilder.createPaginatedResponse({
      data: enrichedData,
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Watch progress retrieved successfully',
    });
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get watch history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'List of watch history',
    type: PaginatedApiResponseDto(WatchProgressDto),
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async getWatchHistory(
    @UserSession('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, total } = await firstValueFrom(
      this.watchProgressService.getWatchHistory(userId, query),
    );

    const historyData = (data || []).map((item: any) =>
      plainToInstance(WatchProgressDto, item, {
        excludeExtraneousValues: true,
      }),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: historyData,
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Watch history retrieved successfully',
    });
  }

  @Get('recently-watched')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get recently watched contents for quick resume' })
  @ApiOkResponse({
    description: 'List of recently watched contents',
    type: [WatchProgressDto],
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async getRecentlyWatched(@UserSession('id') userId: string) {
    const result = await firstValueFrom(
      this.watchProgressService.getRecentlyWatched(userId, 10),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(WatchProgressDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Recently watched contents retrieved successfully',
    });
  }

  @Get(':videoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get watch progress for a specific video' })
  @ApiOkResponse({
    description: 'Watch progress retrieved successfully',
    type: WatchProgressDto,
  })
  @ApiNotFoundResponse({ description: 'Watch progress not found' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async getWatchProgress(
    @UserSession('id') userId: string,
    @Param('videoId') videoId: string,
  ) {
    const result = await firstValueFrom(
      this.watchProgressService.getWatchProgress(userId, videoId),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(WatchProgressDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Watch progress retrieved successfully',
    });
  }

  @Put(':videoId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark video as completed' })
  @ApiOkResponse({
    description: 'Video marked as completed',
    type: ApiResponseDto(WatchProgressDto),
  })
  @ApiNotFoundResponse({ description: 'Watch progress not found' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async markAsCompleted(
    @UserSession('id') userId: string,
    @Param('videoId') videoId: string,
  ) {
    const result = await firstValueFrom(
      this.watchProgressService.markAsCompleted(userId, videoId),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(WatchProgressDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Video marked as completed successfully',
    });
  }

  @Delete(':videoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete watch progress for a video' })
  @ApiOkResponse({ description: 'Watch progress deleted successfully' })
  @ApiNotFoundResponse({ description: 'Watch progress not found' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async deleteWatchProgress(
    @UserSession('id') userId: string,
    @Param('videoId') videoId: string,
  ) {
    return firstValueFrom(
      this.watchProgressService.deleteWatchProgress(userId, videoId),
    );
  }
}
