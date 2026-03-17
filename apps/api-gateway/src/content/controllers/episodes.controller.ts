import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@app/common/decorators/public.decorator';

import { ContentService } from '../content.service';

@ApiTags('Content / Episodes')
@Controller('episodes')
export class EpisodesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get episode detail by ID' })
  getEpisodeById(@Param('id') id: string) {
    return this.contentService.getEpisodeById(id);
  }
}
