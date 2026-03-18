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
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
  CategoryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@app/common/dtos/content/category.dto';
import { TVSeriesCategory } from '@app/common/dtos/content/tvseries.dto';
import { plainToInstance } from 'class-transformer';

import { ContentService } from '../content.service';

@ApiTags('Content / Categories')
@Controller('categories')
@ApiBearerAuth('access-token')
export class CategoriesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all categories' })
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
    description: 'Sort order for categories',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search categories by name',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all categories',
    type: PaginatedApiResponseDto(CategoryDto),
  })
  async getCategories(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(
      this.contentService.getCategories(query),
    );
    const categories = result?.data ?? [];
    const total = result?.total ?? 0;

    return ResponseBuilder.createPaginatedResponse({
      data: categories.map((category: any) =>
        plainToInstance(CategoryDto, category, {
          excludeExtraneousValues: true,
        }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Categories retrieved successfully',
    });
  }

  @Public()
  @Get('tv-series-count')
  @ApiOperation({ summary: 'Get all categories with TV series count' })
  @ApiResponse({
    status: 200,
    description: 'List of categories with total TV series',
    type: ApiResponseDto([TVSeriesCategory]),
  })
  async getCategoriesWithTvSeriesCount() {
    const categories = await firstValueFrom(
      this.contentService.getCategoriesWithTvSeriesCount(),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(TVSeriesCategory, categories, {
        excludeExtraneousValues: true,
      }),
      message: 'Categories with count retrieved successfully',
    });
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search categories' })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search categories by name',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matched categories',
    type: ApiResponseDto([CategoryDto]),
  })
  async searchCategories(@Query('q') q: string) {
    const categories = await firstValueFrom(
      this.contentService.searchCategories(q || ''),
    );

    return ResponseBuilder.createResponse({
      data: (categories || []).map((category: any) =>
        plainToInstance(CategoryDto, category, {
          excludeExtraneousValues: true,
        }),
      ),
      message: 'Categories retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({
    name: 'id',
    description: 'Category ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The category details',
    type: ApiResponseDto(CategoryDto),
  })
  @ApiNotFoundResponse({
    description: 'Category not found',
  })
  async getCategoryById(@Param('id', new ParseUUIDPipe()) id: string) {
    const category = await firstValueFrom(
      this.contentService.getCategoryById(id),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(CategoryDto, category, {
        excludeExtraneousValues: true,
      }),
      message: 'Category retrieved successfully',
    });
  }

  @Post()
  //@UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Create new category' })
  @ApiResponse({
    status: 201,
    description: 'The category has been successfully created.',
    type: ApiResponseDto(CategoryDto),
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
  async createCategory(@Body() body: CreateCategoryDto) {
    const category = await firstValueFrom(
      this.contentService.createCategory(body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(CategoryDto, category, {
        excludeExtraneousValues: true,
      }),
      message: 'Category created successfully',
      statusCode: 201,
    });
  }

  @Put(':id')
  //@UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Update category' })
  @ApiParam({
    name: 'id',
    description: 'Category ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The category has been successfully updated.',
    type: ApiResponseDto(CategoryDto),
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data.',
  })
  @ApiNotFoundResponse({
    description: 'Category not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const category = await firstValueFrom(
      this.contentService.updateCategory(id, body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(CategoryDto, category, {
        excludeExtraneousValues: true,
      }),
      message: 'Category updated successfully',
    });
  }

  @Delete(':id')
  //@UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Delete category' })
  @ApiParam({
    name: 'id',
    description: 'Category ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The category has been successfully deleted.',
  })
  @ApiNotFoundResponse({
    description: 'Category not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async deleteCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.contentService.deleteCategory(id);

    return ResponseBuilder.createResponse({
      message: 'Category deleted successfully',
      data: null,
    });
  }
}
