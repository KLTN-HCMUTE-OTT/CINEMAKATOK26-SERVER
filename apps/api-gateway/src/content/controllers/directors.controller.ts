import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';

import { Public } from '@app/common/decorators/public.decorator';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';
import { ResponseBuilder } from '@app/common/utils/dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { plainToInstance } from 'class-transformer';
import {
  CreateDirectorDto,
  DirectorContentDto,
  DirectorDto,
  UpdateDirectorDto,
} from '@app/common/dtos/content/director.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / Directors')
@Controller('directors')
@ApiBearerAuth('access-token')
export class DirectorsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all directors' })
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
    description: 'Sort order for directors',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search directors by name or nationality',
  })
  async getDirectors(@Query() query: PaginationQueryDto) {
    const result = await firstValueFrom(this.contentService.getDirectors(query));
    const directors = result?.data ?? [];
    const total = result?.total ?? 0;

    return ResponseBuilder.createPaginatedResponse({
      data: directors.map((director: any) =>
        plainToInstance(DirectorDto, director, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Directors retrieved successfully',
    });
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search directors' })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search directors by name or nationality',
  })
  async searchDirectors(@Query('q') q: string) {
    const directors = await firstValueFrom(
      this.contentService.searchDirectors(q || ''),
    );

    return ResponseBuilder.createResponse({
      data: (directors || []).map((director: any) =>
        plainToInstance(DirectorDto, director, { excludeExtraneousValues: true }),
      ),
      message: 'Directors retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a director by ID with all contents' })
  @ApiParam({
    name: 'id',
    description: 'Director ID',
    type: String,
  })
  async getDirectorById(@Param('id') id: string) {
    const director = await firstValueFrom(this.contentService.getDirectorById(id));

    const directorDetail = {
      ...plainToInstance(DirectorDto, director, { excludeExtraneousValues: true }),
      contents:
        director?.contents?.map((content: any) =>
          plainToInstance(
            DirectorContentDto,
            {
              id: content.movieOrSeriesId,
              contentId: content.id,
              type: content.type,
              title: content.title,
              description: content.description,
              thumbnail: content.thumbnail,
              releaseDate: content.releaseDate,
              duration: content.duration,
              rating: content.rating,
            },
            { excludeExtraneousValues: true },
          ),
        ) || [],
      contentCount: director?.contents?.length || 0,
    };

    return ResponseBuilder.createResponse({
      message: 'Director retrieved successfully',
      data: directorDetail,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Create a new director' })
  async createDirector(@Body() body: CreateDirectorDto) {
    const director = await firstValueFrom(this.contentService.createDirector(body));

    return ResponseBuilder.createResponse({
      message: 'Director created successfully',
      data: plainToInstance(DirectorDto, director, { excludeExtraneousValues: true }),
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Update a director' })
  @ApiParam({
    name: 'id',
    description: 'Director ID',
    type: String,
  })
  async updateDirector(@Param('id') id: string, @Body() body: UpdateDirectorDto) {
    const director = await firstValueFrom(this.contentService.updateDirector(id, body));

    return ResponseBuilder.createResponse({
      message: 'Director updated successfully',
      data: plainToInstance(DirectorDto, director, { excludeExtraneousValues: true }),
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiOperation({ summary: '[ADMIN] Delete a director' })
  @ApiParam({
    name: 'id',
    description: 'Director ID',
    type: String,
  })
  async deleteDirector(@Param('id') id: string) {
    await this.contentService.deleteDirector(id);

    return ResponseBuilder.createResponse({
      message: 'Director deleted successfully',
      data: null,
    });
  }
}
