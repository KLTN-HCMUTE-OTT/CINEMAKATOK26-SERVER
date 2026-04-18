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
  ApiResponseDto,
  PaginatedApiResponseDto,
  ResponseBuilder,
} from '@app/common/utils/dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import {
  CreateTVSeriesDto,
  TVSeriesDto,
  UpdateTVSeriesDto,
  TVSeriesSummaryDto,
} from '@app/common/dtos/content/tvseries.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / TV Series')
@Controller('tv-series')
export class TvSeriesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get TV series list' })
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
    description: 'Sort order for TV series',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search TV series by title',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all TV series',
    type: PaginatedApiResponseDto(TVSeriesSummaryDto),
  })
  async getTvSeries(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getTvSeries(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((series: any) =>
        plainToInstance(TVSeriesSummaryDto, series, {
          excludeExtraneousValues: true,
        }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'TV series retrieved successfully',
    });
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending TV series' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search TV series by title',
  })
  @ApiResponse({
    status: 200,
    description: 'List of trending TV series',
    type: PaginatedApiResponseDto(TVSeriesSummaryDto),
  })
  async getTrendingTvSeries(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getTrendingTvSeries(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((series: any) =>
        plainToInstance(TVSeriesSummaryDto, series, {
          excludeExtraneousValues: true,
        }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Trending TV series retrieved successfully',
    });
  }

  @Public()
  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get TV series by category' })
  @ApiResponse({
    status: 200,
    description: 'List of TV series in the specified category',
    type: PaginatedApiResponseDto(TVSeriesSummaryDto),
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search TV series by title',
  })
  async getTvSeriesByCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, total } = await firstValueFrom(
      this.contentService.getTvSeriesByCategory(categoryId, query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((series: any) =>
        plainToInstance(TVSeriesSummaryDto, series, {
          excludeExtraneousValues: true,
        }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'TV series retrieved successfully',
    });
  }

  @Public()
  @Get('new-episodes')
  @ApiOperation({ summary: 'Get TV series with latest episodes' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "createdAt": "DESC" }',
  })
  @ApiResponse({
    status: 200,
    description: 'List of TV series with latest episodes',
    type: PaginatedApiResponseDto(TVSeriesSummaryDto),
  })
  async getTvSeriesWithNewEpisodes(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getTvSeriesWithNewEpisodes(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((series: any) =>
        plainToInstance(TVSeriesSummaryDto, series, {
          excludeExtraneousValues: true,
        }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'TV series with new episodes retrieved successfully',
    });
  }

  @Public()
  @Get(':id/related')
  @ApiOperation({ summary: 'Get related TV series' })
  @ApiResponse({
    status: 200,
    description: 'List of related TV series',
    type: PaginatedApiResponseDto(TVSeriesSummaryDto),
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRelatedTvSeries(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, total } = await firstValueFrom(
      this.contentService.getRelatedTvSeries(id, query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((series: any) =>
        plainToInstance(TVSeriesSummaryDto, series, {
          excludeExtraneousValues: true,
        }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Related TV series retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get TV series detail by ID' })
  @ApiResponse({
    status: 200,
    description: 'TV series detail retrieved successfully',
    type: ApiResponseDto(TVSeriesDto),
  })
  @ApiNotFoundResponse({ description: 'TV series not found' })
  async getTvSeriesById(@Param('id', new ParseUUIDPipe()) id: string) {
    const series = await firstValueFrom(
      this.contentService.getTvSeriesById(id),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(TVSeriesDto, series, {
        excludeExtraneousValues: true,
      }),
      message: 'TV series retrieved successfully',
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Create TV series' })
  @ApiResponse({
    status: 201,
    description: 'TV series created successfully',
    type: ApiResponseDto(TVSeriesDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async createTvSeries(@Body() body: CreateTVSeriesDto) {
    const result = await firstValueFrom(
      this.contentService.createTvSeries(body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(TVSeriesDto, result, {
        excludeExtraneousValues: true,
      }),
      statusCode: 201,
      message: 'TV series created successfully',
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Update TV series' })
  @ApiResponse({
    status: 200,
    description: 'TV series updated successfully',
    type: ApiResponseDto(TVSeriesDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'TV series not found' })
  async updateTvSeries(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTVSeriesDto,
  ) {
    const result = await firstValueFrom(
      this.contentService.updateTvSeries(id, body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(TVSeriesDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'TV series updated successfully',
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Delete TV series' })
  @ApiResponse({
    status: 200,
    description: 'TV series deleted successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'TV series not found' })
  async deleteTvSeries(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.contentService.deleteTvSeries(id);

    return ResponseBuilder.createResponse({
      data: null,
      message: 'TV series deleted successfully',
    });
  }
}
