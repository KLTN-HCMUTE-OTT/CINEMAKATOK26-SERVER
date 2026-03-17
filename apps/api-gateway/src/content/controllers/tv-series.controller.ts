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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@app/common/decorators/public.decorator';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';

import { ContentService } from '../content.service';

@ApiTags('Content / TV Series')
@Controller('tv-series')
export class TvSeriesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get TV series list' })
  getTvSeries(@Query() query: Record<string, any>) {
    return this.contentService.getTvSeries(query);
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending TV series' })
  getTrendingTvSeries(@Query() query: Record<string, any>) {
    return this.contentService.getTrendingTvSeries(query);
  }

  @Public()
  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get TV series by category' })
  getTvSeriesByCategory(
    @Param('categoryId') categoryId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.contentService.getTvSeriesByCategory(categoryId, query);
  }

  @Public()
  @Get('new-episodes')
  @ApiOperation({ summary: 'Get TV series with latest episodes' })
  getTvSeriesWithNewEpisodes(@Query() query: Record<string, any>) {
    return this.contentService.getTvSeriesWithNewEpisodes(query);
  }

  @Public()
  @Get(':id/related')
  @ApiOperation({ summary: 'Get related TV series' })
  getRelatedTvSeries(
    @Param('id') id: string,
    @Query() query: Record<string, any>,
  ) {
    return this.contentService.getRelatedTvSeries(id, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get TV series detail by ID' })
  getTvSeriesById(@Param('id') id: string) {
    return this.contentService.getTvSeriesById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create TV series' })
  createTvSeries(@Body() body: Record<string, any>) {
    return this.contentService.createTvSeries(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update TV series' })
  updateTvSeries(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateTvSeries(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete TV series' })
  deleteTvSeries(@Param('id') id: string) {
    return this.contentService.deleteTvSeries(id);
  }
}
