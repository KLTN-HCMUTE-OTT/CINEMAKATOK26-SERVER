import { firstValueFrom } from 'rxjs';

import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
import {
  ChurnPredictionItemDto,
  ViewForecastItemDto,
} from '@app/common/dtos/analytics/forecast.dto';

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

  @Get('forecast/views')
  @ApiOperation({ summary: 'Get ML view forecast for contents' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "totalForecast7d": "DESC" }',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'View forecast retrieved successfully',
    type: PaginatedApiResponseDto(ViewForecastItemDto),
  })
  async getViewForecast(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.analyticsService.getViewForecast(query),
    );
    const maeText =
      result.metrics?.mae !== null && result.metrics?.mae !== undefined
        ? `MAE=${result.metrics.mae}`
        : 'MAE=NA';
    const mapeText =
      result.metrics?.mape !== null && result.metrics?.mape !== undefined
        ? `MAPE=${result.metrics.mape}%`
        : 'MAPE=NA';
    return ResponseBuilder.createPaginatedResponse({
      data: result.data,
      totalItems: result.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: `View forecast retrieved successfully. Generated at ${result.generatedAt || 'unknown'}. ${maeText}, ${mapeText}`,
    });
  }

  @Get('forecast/churn')
  @ApiOperation({ summary: 'Get ML churn and return prediction for users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "churnProbability": "DESC" }',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Churn prediction retrieved successfully',
    type: PaginatedApiResponseDto(ChurnPredictionItemDto),
  })
  async getChurnPrediction(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.analyticsService.getChurnPrediction(query),
    );

    const f1Text =
      result.metrics?.f1 !== null && result.metrics?.f1 !== undefined
        ? `F1=${result.metrics.f1}`
        : 'F1=NA';
    const logLossText =
      result.metrics?.logLoss !== null && result.metrics?.logLoss !== undefined
        ? `logLoss=${result.metrics.logLoss}`
        : 'logLoss=NA';

    return ResponseBuilder.createPaginatedResponse({
      data: result.data,
      totalItems: result.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: `Churn prediction retrieved successfully. Generated at ${result.generatedAt || 'unknown'}. ${f1Text}, ${logLossText}`,
    });
  }

  @Post('forecast/retrain')
  @ApiOperation({ summary: 'Manually trigger forecast model retraining' })
  @ApiResponse({
    status: 200,
    description: 'Forecast retraining triggered successfully',
    schema: {
      example: {
        statusCode: 200,
        data: { success: true, message: 'Forecast retraining completed' },
        message: 'Forecast model retraining triggered successfully',
      },
    },
  })
  async retrainForecast() {
    const result = await firstValueFrom(
      this.analyticsService.retrainForecast(),
    );
    return ResponseBuilder.createResponse({
      data: result,
      message: 'Forecast model retraining triggered successfully',
    });
  }

  @Post('forecast/churn/retrain')
  @ApiOperation({ summary: 'Manually trigger churn model retraining' })
  @ApiResponse({
    status: 200,
    description: 'Churn retraining triggered successfully',
    schema: {
      example: {
        statusCode: 200,
        data: { success: true, message: 'Churn retraining completed' },
        message: 'Churn model retraining triggered successfully',
      },
    },
  })
  async retrainChurnPrediction() {
    const result = await firstValueFrom(
      this.analyticsService.retrainChurnPrediction(),
    );
    return ResponseBuilder.createResponse({
      data: result,
      message: 'Churn model retraining triggered successfully',
    });
  }
}
