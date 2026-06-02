import { Controller,   Delete, Query, Put,   Body, Get, Param, Post, UseGuards, } from "@nestjs/common";
import { ApiBearerAuth, ApiTags,   ApiOperation, ApiQuery, ApiOkResponse, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from "@nestjs/swagger";
import { EpisodeReviewService } from "../services/episode-review.service";
import { firstValueFrom } from 'rxjs';

import { UserSession } from '@app/common/decorators';
import { JwtAuthGuard, IsAdminGuard } from '@app/common/guards';
import { ApiResponseDto, ResponseBuilder, PaginatedApiResponseDto, PaginationQueryDto} from '@app/common/utils/dto';
import { EpisodeReviewDto, CreateEpisodeReviewDto, UpdateEpisodeReviewDto } from "@app/common/dtos/user-activity/episode-review.dto";
import { plainToInstance } from "class-transformer";
@Controller('episode-reviews')
@ApiTags('User Activity / episode-reviews')
@ApiBearerAuth('access-token')
export class EpisodeReviewController {
    constructor(
        private readonly episodeReviewService: EpisodeReviewService,
    ) {}
    @Get()
  @ApiOperation({ summary: 'Get all reviews' })
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
    description: 'Sort order for reviews',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search reviews by content or user name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter reviews by status (ACTIVE, BANNED). Default: ACTIVE',
    example: 'ACTIVE',
  })
  @ApiOkResponse({
    description: 'List of reviews',
    type: PaginatedApiResponseDto(EpisodeReviewDto),
  })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async findAll(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(this.episodeReviewService.getEpisodeReviews(query && {}));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: EpisodeReviewDto) => plainToInstance(EpisodeReviewDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Reviews retrieved successfully',
    });
  }
  @Get('by-user')
  @ApiOperation({ summary: 'Get reviews by user ID' })
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'List of reviews by user',
    type: PaginatedApiResponseDto(EpisodeReviewDto),
  })
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
    description: 'Sort order for reviews',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search reviews by content or user name',
  })
  async findReviewsByUserId(@UserSession('id') userId: string, @Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(this.episodeReviewService.getEpisodeReviewsByUserId(query && {userId}));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: EpisodeReviewDto) => plainToInstance(EpisodeReviewDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Reviews retrieved successfully',
    });
  }
  @Get('for-episode/:episodeId')
  @ApiOperation({ summary: 'Get reviews for a specific episode by episode ID' })
  @ApiOkResponse({
    description: 'List of reviews for the episode',
    type: PaginatedApiResponseDto(EpisodeReviewDto),
  })
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
    description: 'Sort order for reviews',
    example: '{ "createdAt": "DESC" }',
  })
  async getReviewForEpisode(
    @Param('episodeId') episodeId: string,
    @Query() query: PaginationQueryDto,
    @Query('userId') userId?: string,
  ) {
    const {data, total} = await firstValueFrom(this.episodeReviewService.getEpisodeReviewsByEpisodeId({ ...query, episodeId, ...(userId ? { userId } : {}) }));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: EpisodeReviewDto) => plainToInstance(EpisodeReviewDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Reviews retrieved successfully',
    });
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a review by ID' })
  @ApiOkResponse({ description: 'Review details', type: ApiResponseDto(EpisodeReviewDto) })
  async findOne(@Param('id') id: string) {
    return ResponseBuilder.createResponse({
      message: 'Review retrieved successfully',
      data: plainToInstance(EpisodeReviewDto, await firstValueFrom(this.episodeReviewService.getEpisodeReviewById(id)), {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  @ApiOkResponse({
    description: 'Review created successfully',
    type: ApiResponseDto(EpisodeReviewDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @UseGuards(JwtAuthGuard)
  async createReview(
    @UserSession('id') userId: string,
    @Body() createReviewDto: CreateEpisodeReviewDto,
  ) {
    const review = await firstValueFrom(this.episodeReviewService.createEpisodeReview(userId, createReviewDto));
    return ResponseBuilder.createResponse({
      message: 'Review created successfully',
      data: plainToInstance(EpisodeReviewDto, review, { excludeExtraneousValues: true }),
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a review by ID' })
  @ApiOkResponse({
    description: 'Review updated successfully',
    type: ApiResponseDto(EpisodeReviewDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @ApiNotFoundResponse({
    description: 'Review not found',
  })
  @UseGuards(JwtAuthGuard)
  async updateReview(
    @Param('id') id: string,
    @UserSession('id') userId: string,
    @Body() updateEpisodeReviewDto: UpdateEpisodeReviewDto,
  ) {
    const review = await firstValueFrom(this.episodeReviewService.updateEpisodeReview(updateEpisodeReviewDto, id, userId));
    return ResponseBuilder.createResponse({
      message: 'Review updated successfully',
      data: plainToInstance(EpisodeReviewDto, review, { excludeExtraneousValues: true }),
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review by ID' })
  @ApiOkResponse({ description: 'Review deleted successfully', type: ApiResponseDto(EpisodeReviewDto) })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @ApiNotFoundResponse({
    description: 'Review not found',
  })
  @UseGuards(JwtAuthGuard)
  async deleteReview(@Param('id') id: string, @UserSession('id') userId: string) {
    await firstValueFrom(this.episodeReviewService.deleteEpisodeReview(id, userId));
    return ResponseBuilder.createResponse({
      message: 'Review deleted successfully',
      data: null,
    });
  }

  @Get('check-owner/:id')
  @ApiOperation({ summary: 'Check if user is the owner of a review' })
  @ApiOkResponse({ description: 'Ownership check result' })
  @ApiNotFoundResponse({
    description: 'Review not found',
  })
  @UseGuards(JwtAuthGuard)
  async checkReviewOwner(@Param('id') id: string, @UserSession('id') userId: string) {
    const isOwner = await firstValueFrom(this.episodeReviewService.checkReviewOwner(id, userId));
    return ResponseBuilder.createResponse({
      message: 'Ownership check completed',
      data: { isOwner },
    });
  }
}