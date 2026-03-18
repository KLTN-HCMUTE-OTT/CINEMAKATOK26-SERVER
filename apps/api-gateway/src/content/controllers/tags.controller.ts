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
  CreateTagDto,
  TagDto,
  UpdateTagDto,
} from '@app/common/dtos/content/tag.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / Tags')
@Controller('tags')
@ApiBearerAuth('access-token')
export class TagsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all tags' })
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
    description: 'Sort order for tags',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search tags by name',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all tags',
    type: PaginatedApiResponseDto(TagDto),
  })
  async getTags(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(this.contentService.getTags(query));
    const tags = result?.data ?? [];
    const total = result?.total ?? 0;

    return ResponseBuilder.createPaginatedResponse({
      data: tags.map((tag: any) =>
        plainToInstance(TagDto, tag, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Tags retrieved successfully',
    });
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search tags' })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search tags by name',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matched tags',
    type: ApiResponseDto([TagDto]),
  })
  async searchTags(@Query('q') q: string) {
    const tags = await firstValueFrom(this.contentService.searchTags(q || ''));

    return ResponseBuilder.createResponse({
      data: (tags || []).map((tag: any) =>
        plainToInstance(TagDto, tag, { excludeExtraneousValues: true }),
      ),
      message: 'Tags retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get tag by ID' })
  @ApiParam({
    name: 'id',
    description: 'Tag ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The tag details',
    type: ApiResponseDto(TagDto),
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  async getTagById(@Param('id', new ParseUUIDPipe()) id: string) {
    const tag = await firstValueFrom(this.contentService.getTagById(id));

    return ResponseBuilder.createResponse({
      data: plainToInstance(TagDto, tag, { excludeExtraneousValues: true }),
      message: 'Tag retrieved successfully',
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Create a new tag' })
  @ApiResponse({
    status: 201,
    description: 'The tag has been successfully created.',
    type: ApiResponseDto(TagDto),
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
  async createTag(@Body() body: CreateTagDto) {
    const tag = await firstValueFrom(this.contentService.createTag(body));

    return ResponseBuilder.createResponse({
      data: plainToInstance(TagDto, tag, { excludeExtraneousValues: true }),
      message: 'Tag created successfully',
      statusCode: 201,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Update a tag' })
  @ApiParam({
    name: 'id',
    description: 'Tag ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The tag has been successfully updated.',
    type: ApiResponseDto(TagDto),
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data.',
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async updateTag(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateTagDto) {
    const tag = await firstValueFrom(this.contentService.updateTag(id, body));

    return ResponseBuilder.createResponse({
      data: plainToInstance(TagDto, tag, { excludeExtraneousValues: true }),
      message: 'Tag updated successfully',
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Delete a tag' })
  @ApiParam({
    name: 'id',
    description: 'Tag ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The tag has been successfully deleted.',
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async deleteTag(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.contentService.deleteTag(id);

    return ResponseBuilder.createResponse({
      data: null,
      message: 'Tag deleted successfully',
    });
  }
}
