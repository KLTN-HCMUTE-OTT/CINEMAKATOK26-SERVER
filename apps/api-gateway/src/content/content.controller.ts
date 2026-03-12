import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { Public } from '@app/common/decorators/public.decorator';

@ApiTags('Content')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get('movies')
  @ApiOperation({ summary: 'Browse movie catalogue' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'genre', required: false, type: String })
  getMovies(@Query() query: Record<string, any>) {
    return this.contentService.getMovies(query);
  }

  @Public()
  @Get('movies/:id')
  @ApiOperation({ summary: 'Get movie detail by ID' })
  getMovieById(@Param('id') id: string) {
    return this.contentService.getMovieById(id);
  }

  @Public()
  @Get('episodes/:id')
  @ApiOperation({ summary: 'Get episode detail by ID' })
  getEpisodeById(@Param('id') id: string) {
    return this.contentService.getEpisodeById(id);
  }

  @ApiBearerAuth('access-token')
  @Get('movies/:id/related')
  @ApiOperation({ summary: 'Get related movies (requires auth)' })
  getRelatedMovies(@Param('id') id: string) {
    return this.contentService.getRelatedMovies(id);
  }
}
