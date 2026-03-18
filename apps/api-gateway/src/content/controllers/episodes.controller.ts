import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { Public } from '@app/common/decorators/public.decorator';
import { ResponseBuilder } from '@app/common/utils/dto';
import { EpisodeDto } from '@app/common/dtos/content/episode.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / Episodes')
@Controller('episodes')
export class EpisodesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get episode detail by ID' })
  @ApiResponse({
    status: 200,
    description: 'Episode detail retrieved successfully',
    type: EpisodeDto,
  })
  @ApiNotFoundResponse({ description: 'Episode not found' })
  async getEpisodeById(@Param('id', new ParseUUIDPipe()) id: string) {
    const episode = await firstValueFrom(
      this.contentService.getEpisodeById(id),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(EpisodeDto, episode, {
        excludeExtraneousValues: true,
      }),
      message: 'Episode retrieved successfully',
    });
  }
}
