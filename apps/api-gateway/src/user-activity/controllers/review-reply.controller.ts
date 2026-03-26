import { plainToInstance } from 'class-transformer';

import { UserSession } from '@app/common/decorators';
import { IsAdminGuard } from '@app/common/guards';
import { JwtAuthGuard } from '@app/common/guards/auth.guard';
import { ApiResponseDto } from '@app/common/utils/dto';
import { PaginatedApiResponseDto } from '@app/common/utils/dto/paginated-api-response.dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { ResponseBuilder } from '@app/common/utils/dto/response-builder';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
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

import { CreateReviewReplyDto, ReviewReplyDto, UpdateReviewReplyDto } from "@app/common/dtos/user-activity/review-reply.dto";
import { ReviewReplyService } from '../services/review-reply.service';
import { firstValueFrom } from 'rxjs';

@Controller('review-replies')
@ApiTags('User Activity / Review Replies')
@ApiBearerAuth('access-token')
export class ReviewReplyController {
  constructor(private readonly reviewReplyService: ReviewReplyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all review replies (Admin only)' })
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
    description: 'Sort order for replies',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search replies by content',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter replies by status (ACTIVE, BANNED). Default: ACTIVE',
    example: 'ACTIVE',
  })
  @ApiOkResponse({
    description: 'List of replies',
    type: PaginatedApiResponseDto(ReviewReplyDto),
  })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async findAll(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(this.reviewReplyService.findReplies(query as any));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: ReviewReplyDto) => plainToInstance(ReviewReplyDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Replies retrieved successfully',
    });
  }

  @Get('by-user')
  @ApiOperation({ summary: 'Get replies by user ID' })
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'List of replies by user',
    type: PaginatedApiResponseDto(ReviewReplyDto),
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
    description: 'Sort order for replies',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search replies by content',
  })
  async findRepliesByUserId(@UserSession('id') userId: string, @Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(this.reviewReplyService.findReplies(query && {userId}));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: ReviewReplyDto) => plainToInstance(ReviewReplyDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Replies retrieved successfully',
    });
  }

  @Get('for-review/:reviewId')
  @ApiOperation({ summary: 'Get replies for a specific review' })
  @ApiOkResponse({
    description: 'List of replies for the review',
    type: PaginatedApiResponseDto(ReviewReplyDto),
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
    description: 'Sort order for replies',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'parentReplyId',
    required: false,
    type: String,
    description: 'Parent reply ID to get nested replies. Use "null" to get only top-level replies',
  })
  async getRepliesForReview(
    @Param('reviewId') reviewId: string,
    @Query() query: PaginationQueryDto & { parentReplyId?: string },
  ) {
    const { data, total } = await firstValueFrom(this.reviewReplyService.findRepliesForReview(reviewId, query));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: ReviewReplyDto) => plainToInstance(ReviewReplyDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Replies retrieved successfully',
    });
  }

  @Get('for-episode-review/:episodeReviewId')
  @ApiOperation({ summary: 'Get replies for a specific episode review' })
  @ApiOkResponse({
    description: 'List of replies for the episode review',
    type: PaginatedApiResponseDto(ReviewReplyDto),
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
    description: 'Sort order for replies',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'parentReplyId',
    required: false,
    type: String,
    description: 'Parent reply ID to get nested replies. Use "null" to get only top-level replies',
  })
  async getRepliesForEpisodeReview(
    @Param('episodeReviewId') episodeReviewId: string,
    @Query() query: PaginationQueryDto & { parentReplyId?: string },
  ) {
    const { data, total } = await firstValueFrom(this.reviewReplyService.findReplies(query && {episodeReviewId}));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: ReviewReplyDto) => plainToInstance(ReviewReplyDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Replies retrieved successfully',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reply by ID' })
  @ApiOkResponse({ description: 'Reply details', type: ApiResponseDto(ReviewReplyDto) })
  @ApiNotFoundResponse({
    description: 'Reply not found',
  })
  async findOne(@Param('id') id: string) {
    return ResponseBuilder.createResponse({
      message: 'Reply retrieved successfully',
      data: plainToInstance(ReviewReplyDto, await firstValueFrom(this.reviewReplyService.findReplyById(id)), {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new reply' })
  @ApiOkResponse({
    description: 'Reply created successfully',
    type: ApiResponseDto(ReviewReplyDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @UseGuards(JwtAuthGuard)
  async createReply(
    @UserSession('id') userId: string,
    @Body() createReplyDto: CreateReviewReplyDto,
  ) {
    const reply = await firstValueFrom(this.reviewReplyService.createReply(userId, createReplyDto));
    return ResponseBuilder.createResponse({
      message: 'Reply created successfully',
      data: plainToInstance(ReviewReplyDto, reply, { excludeExtraneousValues: true }),
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a reply by ID' })
  @ApiOkResponse({
    description: 'Reply updated successfully',
    type: ApiResponseDto(ReviewReplyDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @ApiNotFoundResponse({
    description: 'Reply not found',
  })
  @UseGuards(JwtAuthGuard)
  async updateReply(
    @Param('id') id: string,
    @UserSession('id') userId: string,
    @Body() updateReplyDto: UpdateReviewReplyDto,
  ) {
    const reply = await firstValueFrom(this.reviewReplyService.updateReply(id, updateReplyDto, userId));
    return ResponseBuilder.createResponse({
      message: 'Reply updated successfully',
      data: plainToInstance(ReviewReplyDto, reply, { excludeExtraneousValues: true }),
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a reply by ID' })
  @ApiOkResponse({ description: 'Reply deleted successfully' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  @ApiNotFoundResponse({
    description: 'Reply not found',
  })
  @UseGuards(JwtAuthGuard)
  async deleteReply(@Param('id') id: string, @UserSession('id') userId: string) {
    await firstValueFrom(this.reviewReplyService.deleteReply(id, userId));
    return ResponseBuilder.createResponse({
      message: 'Reply deleted successfully',
      data: null,
    });
  }

  @Get('check-owner/:id')
  @ApiOperation({ summary: 'Check if user is the owner of a reply' })
  @ApiOkResponse({ description: 'Ownership check result' })
  @ApiNotFoundResponse({
    description: 'Reply not found',
  })
  @UseGuards(JwtAuthGuard)
  async checkReplyOwner(@Param('id') id: string, @UserSession('id') userId: string) {
    const isOwner = await firstValueFrom(this.reviewReplyService.isReplyOwner(id, userId));
    return ResponseBuilder.createResponse({
      message: 'Ownership check completed',
      data: { isOwner },
    });
  }

  @Get('count/review/:reviewId')
  @ApiOperation({ summary: 'Get total reply count for a review' })
  @ApiOkResponse({
    description: 'Reply count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        reviewId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        replyCount: { type: 'number', example: 15 },
        hasReplies: { type: 'boolean', example: true },
      },
    },
  })
  async getReplyCountForReview(@Param('reviewId') reviewId: string) {
    const count = await firstValueFrom(this.reviewReplyService.countRepliesForReview(reviewId));
    return ResponseBuilder.createResponse({
      message: 'Reply count retrieved successfully',
      data: {
        reviewId,
        replyCount: count,
        hasReplies: count > 0,
      },
    });
  }

  @Get('count/reply/:replyId')
  @ApiOperation({ summary: 'Get direct child reply count for a reply' })
  @ApiOkResponse({
    description: 'Reply count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        replyId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        replyCount: { type: 'number', example: 5 },
        hasReplies: { type: 'boolean', example: true },
      },
    },
  })
  async getReplyCountForReply(@Param('replyId') replyId: string) {
    const count = await firstValueFrom(this.reviewReplyService.countRepliesForReply(replyId));
    return ResponseBuilder.createResponse({
      message: 'Reply count retrieved successfully',
      data: {
        replyId,
        replyCount: count,
        hasReplies: count > 0,
      },
    });
  }

  @Get('count/episode-review/:episodeReviewId')
  @ApiOperation({ summary: 'Get total reply count for an episode review' })
  @ApiOkResponse({
    description: 'Reply count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        episodeReviewId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        replyCount: { type: 'number', example: 15 },
        hasReplies: { type: 'boolean', example: true },
      },
    },
  })
  async getReplyCountForEpisodeReview(@Param('episodeReviewId') episodeReviewId: string) {
    const count = await firstValueFrom(this.reviewReplyService.countRepliesForEpisodeReview(episodeReviewId));
    return ResponseBuilder.createResponse({
      message: 'Reply count retrieved successfully',
      data: {
        episodeReviewId,
        replyCount: count,
        hasReplies: count > 0,
      },
    });
  }
}
