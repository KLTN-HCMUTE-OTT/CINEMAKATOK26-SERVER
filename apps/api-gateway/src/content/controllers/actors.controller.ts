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

@ApiTags('Content / Actors')
@Controller('actors')
export class ActorsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get actors list' })
  getActors(@Query() query: Record<string, any>) {
    return this.contentService.getActors(query);
  }

  @Public()
  @Get('top')
  @ApiOperation({ summary: 'Get top actors' })
  getTopActors(@Query() query: Record<string, any>) {
    return this.contentService.getTopActors(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search actors' })
  searchActors(@Query('q') q: string) {
    return this.contentService.searchActors(q || '');
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get actor detail by ID' })
  getActorById(@Param('id') id: string) {
    return this.contentService.getActorById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create actor' })
  createActor(@Body() body: Record<string, any>) {
    return this.contentService.createActor(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update actor' })
  updateActor(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateActor(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete actor' })
  deleteActor(@Param('id') id: string) {
    return this.contentService.deleteActor(id);
  }
}
