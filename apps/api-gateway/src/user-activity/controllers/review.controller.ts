import { Controller, Get, Param, Post, Put, Delete, Query, UseGuards, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiOkResponse, ApiNotFoundResponse, ApiUnauthorizedResponse, ApiBadRequestResponse } from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { JwtAuthGuard } from "@app/common/guards";
import { IsAdminGuard } from "@app/common/guards/is-admin.guard";
import { PaginationQueryDto, PaginatedApiResponseDto, ApiResponseDto, ResponseBuilder } from "@app/common/utils/dto";
import { ReviewService } from "../services/review.service";
import { UserSession } from "@app/common/decorators";
import { ApiBearerAuth } from "@nestjs/swagger";
import { ReviewDto } from "@app/common/dtos/user-activity/review.dto";
import { CreateReviewDto, UpdateReviewDto } from "@app/common/dtos/user-activity/review.dto";
import { firstValueFrom } from "rxjs";

@Controller('reviews')
@ApiTags('User Activity / Review')
@ApiBearerAuth('access-token')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}
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
    type: PaginatedApiResponseDto(ReviewDto),
  })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async findAll(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(this.reviewService.findReviews(query));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map(review => plainToInstance(ReviewDto, review, { excludeExtraneousValues: true })),
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
    type: PaginatedApiResponseDto(ReviewDto),
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
    const { data, total } = await firstValueFrom(this.reviewService.findReviewsByUserId(query, userId))
    return ResponseBuilder.createPaginatedResponse({
      data: data.map(review => plainToInstance(ReviewDto, review, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Reviews retrieved successfully',
    });
  }
  @Get('for-content/:contentId')
  @ApiOperation({ summary: 'Get reviews for a specific content by content ID' })
  @ApiOkResponse({
    description: 'List of reviews for the content',
    type: PaginatedApiResponseDto(ReviewDto),
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
  async getReviewForContent(
    @Param('contentId') contentId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const review = await firstValueFrom(this.reviewService.findReviewsByContentId(query, contentId))
    return ResponseBuilder.createPaginatedResponse({
      data: review.data.map(review => plainToInstance(ReviewDto, review, { excludeExtraneousValues: true })),
      totalItems: review.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Reviews retrieved successfully',
    });
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a review by ID' })
  @ApiOkResponse({ description: 'Review details', type: ApiResponseDto(ReviewDto) })
  @ApiNotFoundResponse({
    description: 'Review not found',
  })
  async findOne(@Param('id') id: string) {
    return ResponseBuilder.createResponse({
      message: 'Review retrieved successfully',
      data: plainToInstance(ReviewDto, await firstValueFrom(this.reviewService.findReviewById(id)), {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  @ApiOkResponse({ description: 'Review created successfully', type: ApiResponseDto(ReviewDto) })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @UseGuards(JwtAuthGuard)
  async createReview(@UserSession('id') userId: string, @Body() createReviewDto: CreateReviewDto) {
    const review = await firstValueFrom(this.reviewService.createReview(userId, createReviewDto))
    return ResponseBuilder.createResponse({
      message: 'Review created successfully',
      data: plainToInstance(ReviewDto, review, { excludeExtraneousValues: true }),
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a review by ID' })
  @ApiOkResponse({ description: 'Review updated successfully', type: ApiResponseDto(ReviewDto) })
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
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    const review = await firstValueFrom(this.reviewService.updateReview(id, updateReviewDto, userId));
    return ResponseBuilder.createResponse({
      message: 'Review updated successfully',
      data: plainToInstance(ReviewDto, review, { excludeExtraneousValues: true }),
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review by ID' })
  @ApiOkResponse({ description: 'Review deleted successfully', type: ApiResponseDto(ReviewDto) })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @ApiNotFoundResponse({
    description: 'Review not found',
  })
  @UseGuards(JwtAuthGuard)
  async deleteReview(
    @Param('id') id: string,
    @UserSession('id') userId: string,
    @UserSession('isAdmin') isAdmin: boolean,
  ) {
    await firstValueFrom(this.reviewService.deleteReview(id, isAdmin ? undefined : userId));
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
    const isOwner = await firstValueFrom(this.reviewService.isReviewOwner(id, userId));
    return ResponseBuilder.createResponse({
      message: 'Ownership check completed',
      data: { isOwner },
    });
  }
}

