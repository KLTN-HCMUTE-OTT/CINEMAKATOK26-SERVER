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

@ApiTags('Content / Directors')
@Controller('directors')
export class DirectorsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get directors list' })
  getDirectors(@Query() query: Record<string, any>) {
    return this.contentService.getDirectors(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search directors' })
  searchDirectors(@Query('q') q: string) {
    return this.contentService.searchDirectors(q || '');
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get director detail by ID' })
  getDirectorById(@Param('id') id: string) {
    return this.contentService.getDirectorById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create director' })
  createDirector(@Body() body: Record<string, any>) {
    return this.contentService.createDirector(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update director' })
  updateDirector(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateDirector(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete director' })
  deleteDirector(@Param('id') id: string) {
    return this.contentService.deleteDirector(id);
  }
}
