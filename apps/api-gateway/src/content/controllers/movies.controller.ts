import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '@app/common/decorators/public.decorator';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';

import { ContentService } from '../content.service';

@ApiTags('Content / Movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse movie catalogue' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'genre', required: false, type: String })
  getMovies(@Query() query: Record<string, any>) {
    return this.contentService.getMovies(query);
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending movies' })
  getTrendingMovies(@Query() query: Record<string, any>) {
    return this.contentService.getTrendingMovies(query);
  }

  @Public()
  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get movies by category' })
  getMoviesByCategory(
    @Param('categoryId') categoryId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.contentService.getMoviesByCategory(categoryId, query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get(':id/related')
  @ApiOperation({ summary: 'Get related movies (requires auth)' })
  getRelatedMovies(
    @Param('id') id: string,
    @Query() query: Record<string, any>,
  ) {
    return this.contentService.getRelatedMovies(id, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get movie detail by ID' })
  getMovieById(@Param('id') id: string) {
    return this.contentService.getMovieById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create movie' })
  createMovie(@Body() body: Record<string, any>) {
    return this.contentService.createMovie(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update movie' })
  updateMovie(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateMovie(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete movie' })
  deleteMovie(@Param('id') id: string) {
    return this.contentService.deleteMovie(id);
  }
}
