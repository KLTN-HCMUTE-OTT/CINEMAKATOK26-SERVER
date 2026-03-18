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
  CreateMovieDto,
  MovieDto,
  UpdateMovieDto,
} from '@app/common/dtos/content/movies.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / Movies')
@Controller('movies')
@ApiBearerAuth('access-token')
export class MoviesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all movies' })
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
    description: 'Sort order for movies',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search movies by title',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all movies',
    type: PaginatedApiResponseDto(MovieDto),
  })
  async getMovies(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getMovies(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((movie: any) =>
        plainToInstance(MovieDto, movie, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Movies retrieved successfully',
    });
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending movies' })
  @ApiResponse({
    status: 200,
    description: 'List of trending movies',
    type: PaginatedApiResponseDto(MovieDto),
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
    description: 'Search movies by title',
  })
  async getTrendingMovies(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getTrendingMovies(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((movie: any) =>
        plainToInstance(MovieDto, movie, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Trending movies retrieved successfully',
    });
  }

  @Public()
  @Get('new-releases')
  @ApiOperation({ summary: 'Get new release movies' })
  @ApiResponse({
    status: 200,
    description: 'List of new release movies',
    type: PaginatedApiResponseDto(MovieDto),
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
    description: 'Search movies by title',
  })
  async getNewReleaseMovies(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getMovies(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((movie: any) =>
        plainToInstance(MovieDto, movie, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'New release movies retrieved successfully',
    });
  }

  @Public()
  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get movies by category' })
  @ApiResponse({
    status: 200,
    description: 'List of movies in the specified category',
    type: PaginatedApiResponseDto(MovieDto),
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
    description: 'Search movies by title, description, etc.',
    example: '{ "title": "Inception", "description": "dream" }',
  })
  async getMoviesByCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, total } = await firstValueFrom(
      this.contentService.getMoviesByCategory(categoryId, query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((movie: any) =>
        plainToInstance(MovieDto, movie, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Movies by category retrieved successfully',
    });
  }

  @Public()
  @Get(':movieId/recommendations')
  @ApiOperation({ summary: 'Get movie recommendations by movie ID' })
  @ApiResponse({
    status: 200,
    description: 'List of recommended movies',
    type: PaginatedApiResponseDto(MovieDto),
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
    description: 'Search movies by title',
    example: '{ "title": "Inception", "description": "dream" }',
  })
  async getRecommendationsByMovieId(
    @Param('movieId', new ParseUUIDPipe()) movieId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, total } = await firstValueFrom(
      this.contentService.getRelatedMovies(movieId, query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((movie: any) =>
        plainToInstance(MovieDto, movie, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Movie recommendations retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get movie by ID' })
  @ApiResponse({
    status: 200,
    description: 'The movie details',
    type: ApiResponseDto(MovieDto),
  })
  @ApiNotFoundResponse({
    description: 'Movie not found',
  })
  async getMovieById(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await firstValueFrom(this.contentService.getMovieById(id));

    return ResponseBuilder.createResponse({
      data: plainToInstance(MovieDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Movie retrieved successfully',
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Create new movie' })
  @ApiResponse({
    status: 201,
    description: 'The movie has been successfully created.',
    type: ApiResponseDto(MovieDto),
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async createMovie(@Body() body: CreateMovieDto) {
    const result = await firstValueFrom(this.contentService.createMovie(body));

    return ResponseBuilder.createResponse({
      data: plainToInstance(MovieDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Movie created successfully',
      statusCode: 201,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Update movie' })
  @ApiResponse({
    status: 200,
    description: 'The movie has been successfully updated.',
    type: ApiResponseDto(MovieDto),
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data.',
  })
  @ApiNotFoundResponse({
    description: 'Movie not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async updateMovie(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMovieDto,
  ) {
    const result = await firstValueFrom(
      this.contentService.updateMovie(id, body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(MovieDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Movie updated successfully',
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Delete movie' })
  @ApiResponse({
    status: 200,
    description: 'The movie has been successfully deleted.',
  })
  @ApiNotFoundResponse({
    description: 'Movie not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async deleteMovie(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.contentService.deleteMovie(id);

    return ResponseBuilder.createResponse({
      data: null,
      message: 'Movie deleted successfully',
    });
  }
}
