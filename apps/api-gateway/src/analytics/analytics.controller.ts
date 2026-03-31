import { firstValueFrom } from 'rxjs';

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';
import {
  PaginatedApiResponseDto,
  ResponseBuilder,
  ApiResponseDto,
} from '@app/common/utils/dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import {
  TrendingItemDto,
  UserStatsDto,
  ViewStatsItemDto,
} from '@app/common/dtos/analytics/analytics.dto';

import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, IsAdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('movies')
  @ApiOperation({ summary: 'Get paginated movie view statistics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "change": "DESC" }',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Movie statistics retrieved successfully',
    type: PaginatedApiResponseDto(ViewStatsItemDto),
  })
  async getMoviesStats(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.analyticsService.getMoviesStats(query),
    );
    return ResponseBuilder.createPaginatedResponse({
      data: result.data,
      totalItems: result.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Movie statistics retrieved successfully',
    });
  }

  @Get('tvseries')
  @ApiOperation({ summary: 'Get paginated TV series view statistics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "change": "DESC" }',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'TV series statistics retrieved successfully',
    type: PaginatedApiResponseDto(ViewStatsItemDto),
  })
  async getTVSeriesStats(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.analyticsService.getTVSeriesStats(query),
    );
    return ResponseBuilder.createPaginatedResponse({
      data: result.data,
      totalItems: result.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'TV series statistics retrieved successfully',
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get paginated category view statistics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "change": "DESC" }',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Category statistics retrieved successfully',
    type: PaginatedApiResponseDto(ViewStatsItemDto),
  })
  async getCategoriesStats(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.analyticsService.getCategoriesStats(query),
    );
    return ResponseBuilder.createPaginatedResponse({
      data: result.data,
      totalItems: result.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Category statistics retrieved successfully',
    });
  }

  @Get('users')
  @ApiOperation({ summary: 'Get user statistics and metrics' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: ApiResponseDto(UserStatsDto),
  })
  async getUserStats() {
    const result = await firstValueFrom(this.analyticsService.getUserStats());
    return ResponseBuilder.createResponse({
      data: result,
      message: 'User statistics retrieved successfully',
    });
  }

  @Get('trending/movies')
  @ApiOperation({ summary: 'Get paginated trending movies data' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "change": "DESC" }',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Trending movies retrieved successfully',
    type: PaginatedApiResponseDto(TrendingItemDto),
  })
  async getTrendingMovies(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.analyticsService.getTrendingMovies(query),
    );
    return ResponseBuilder.createPaginatedResponse({
      data: result.data,
      totalItems: result.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Trending movies retrieved successfully',
    });
  }

  @Get('trending/tvseries')
  @ApiOperation({ summary: 'Get paginated trending TV series data' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "change": "DESC" }',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Trending TV series retrieved successfully',
    type: PaginatedApiResponseDto(TrendingItemDto),
  })
  async getTrendingTVSeries(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.analyticsService.getTrendingTVSeries(query),
    );
    return ResponseBuilder.createPaginatedResponse({
      data: result.data,
      totalItems: result.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Trending TV series retrieved successfully',
    });
  }
}
