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
  OmitType,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { Public, UserSession } from '@app/common/decorators';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';
import {
  CreateNewsDto,
  NewsDto,
  UpdateNewsDto,
} from '@app/common/dtos/content/news.dto';
import {
  ApiResponseDto,
  PaginatedApiResponseDto,
  ResponseBuilder,
} from '@app/common/utils/dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';

import { UserService } from '../../user/user.service';
import { ContentService } from '../content.service';

class CreateNewsBySessionDto extends OmitType(CreateNewsDto, [
  'author_name',
  'author_avatar',
] as const) {}

@ApiTags('Content / News')
@Controller('news')
@ApiBearerAuth('access-token')
export class NewsController {
  constructor(
    private readonly contentService: ContentService,
    private readonly userService: UserService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all news' })
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
    description: 'Sort order for news',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search news by title/content',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all news',
    type: PaginatedApiResponseDto(NewsDto),
  })
  async getNews(@Query() query: PaginationQueryDto) {
    const { data, total } = await firstValueFrom(
      this.contentService.getNews(query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((item: any) =>
        plainToInstance(NewsDto, item, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'News retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get news by ID' })
  @ApiResponse({
    status: 200,
    description: 'News details',
    type: ApiResponseDto(NewsDto),
  })
  @ApiNotFoundResponse({
    description: 'News not found',
  })
  async getNewsById(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await firstValueFrom(this.contentService.getNewsById(id));

    return ResponseBuilder.createResponse({
      data: plainToInstance(NewsDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'News retrieved successfully',
    });
  }

  @Public()
  @Get(':newsId/recommendations')
  @ApiOperation({ summary: 'Get related news by news ID' })
  @ApiResponse({
    status: 200,
    description: 'List of related news',
    type: PaginatedApiResponseDto(NewsDto),
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: '{ "createdAt": "DESC" }',
  })
  async getRelatedNews(
    @Param('newsId', new ParseUUIDPipe()) newsId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, total } = await firstValueFrom(
      this.contentService.getRelatedNews(newsId, query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data: (data || []).map((item: any) =>
        plainToInstance(NewsDto, item, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Related news retrieved successfully',
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Create new news' })
  @ApiResponse({
    status: 201,
    description: 'The news has been successfully created.',
    type: ApiResponseDto(NewsDto),
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
  async createNews(
    @Body() body: CreateNewsBySessionDto,
    @UserSession('id') userId: string,
  ) {
    const profile = await firstValueFrom(this.userService.getProfile(userId));

    const payload: CreateNewsDto = {
      ...body,
      author_name: profile?.name ?? 'Unknown',
      author_avatar: profile?.avatar ?? null,
    };

    const result = await firstValueFrom(
      this.contentService.createNews(payload),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(NewsDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'News created successfully',
      statusCode: 201,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Update news' })
  @ApiResponse({
    status: 200,
    description: 'The news has been successfully updated.',
    type: ApiResponseDto(NewsDto),
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data.',
  })
  @ApiNotFoundResponse({
    description: 'News not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async updateNews(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateNewsDto,
  ) {
    const result = await firstValueFrom(
      this.contentService.updateNews(id, body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(NewsDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'News updated successfully',
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Delete news' })
  @ApiResponse({
    status: 200,
    description: 'The news has been successfully deleted.',
  })
  @ApiNotFoundResponse({
    description: 'News not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async deleteNews(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.contentService.deleteNews(id);

    return ResponseBuilder.createResponse({
      data: null,
      message: 'News deleted successfully',
    });
  }
}
