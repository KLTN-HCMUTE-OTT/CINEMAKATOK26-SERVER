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
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { Public } from '@app/common/decorators/public.decorator';
import { ApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';
import {
  ContentDto,
  ContentFilterDto,
  CreateContentDto,
  UpdateContentDto,
} from '@app/common/dtos/content/content.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / Contents')
@Controller('contents')
@ApiBearerAuth('access-token')
export class ContentsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get movies and TV series with filters' })
  @ApiResponse({
    status: 200,
    description: 'List of movies and TV series',
    type: ApiResponseDto(Object),
  })
  @ApiBadRequestResponse({
    description: 'Invalid filter parameters',
  })
  async getContents(@Query() query: ContentFilterDto) {
    const contents = await firstValueFrom(
      this.contentService.getContents(query),
    );

    return ResponseBuilder.createResponse({
      data: {
        items: {
          movies: (contents?.items?.movies || []).map((content: any) =>
            plainToInstance(ContentDto, content, {
              excludeExtraneousValues: true,
            }),
          ),
          tvSeries: (contents?.items?.tvSeries || []).map((content: any) =>
            plainToInstance(ContentDto, content, {
              excludeExtraneousValues: true,
            }),
          ),
        },
        meta: contents?.meta,
      },
      message: 'Movies and TV series retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get content by ID' })
  @ApiResponse({
    status: 200,
    description: 'The content details',
    type: ApiResponseDto(ContentDto),
  })
  @ApiNotFoundResponse({
    description: 'Content not found',
  })
  async getContentById(@Param('id', new ParseUUIDPipe()) id: string) {
    const content = await firstValueFrom(
      this.contentService.getContentById(id),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(ContentDto, content, {
        excludeExtraneousValues: true,
      }),
      message: 'Content retrieved successfully',
    });
  }

  @Post()
  @ApiOperation({ summary: '[ADMIN] Create new content (movie or TV series)' })
  @ApiResponse({
    status: 201,
    description: 'The content has been successfully created.',
    type: ApiResponseDto(ContentDto),
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or missing required fields',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async createContent(@Body() body: CreateContentDto) {
    const result = await firstValueFrom(
      this.contentService.createContent(body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(ContentDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Content created successfully',
      statusCode: 201,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: '[ADMIN] Update content and its relationships' })
  @ApiResponse({
    status: 200,
    description: 'The content has been successfully updated.',
    type: ApiResponseDto(ContentDto),
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or missing required fields',
  })
  @ApiNotFoundResponse({
    description: 'Content not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async updateContent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateContentDto,
  ) {
    const result = await firstValueFrom(
      this.contentService.updateContent(id, body),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(ContentDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Content updated successfully',
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: '[ADMIN] Delete content and its relationships' })
  @ApiResponse({
    status: 200,
    description: 'Content and related data have been successfully deleted.',
  })
  @ApiNotFoundResponse({
    description: 'Content not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async deleteContent(@Param('id', new ParseUUIDPipe()) id: string) {
    await firstValueFrom(this.contentService.deleteContent(id), {
      defaultValue: null,
    });

    return ResponseBuilder.createResponse({
      data: null,
      message: 'Content deleted successfully',
    });
  }

  @Patch(':id/view')
  @ApiOperation({ summary: 'Increase view count for a content' })
  @ApiResponse({
    status: 200,
    description: 'View count increased successfully',
    type: ApiResponseDto(Boolean),
  })
  @ApiNotFoundResponse({
    description: 'Content not found',
  })
  async increaseViewCount(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await firstValueFrom(this.contentService.increaseViewCount(id));

    return ResponseBuilder.createResponse({
      data: result,
      message: 'View count increased successfully',
    });
  }
}
