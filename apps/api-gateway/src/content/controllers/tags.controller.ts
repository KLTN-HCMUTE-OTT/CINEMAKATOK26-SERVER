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

@ApiTags('Content / Tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get tags list' })
  getTags(@Query() query: Record<string, any>) {
    return this.contentService.getTags(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search tags' })
  searchTags(@Query('q') q: string) {
    return this.contentService.searchTags(q || '');
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get tag detail by ID' })
  getTagById(@Param('id') id: string) {
    return this.contentService.getTagById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create tag' })
  createTag(@Body() body: Record<string, any>) {
    return this.contentService.createTag(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update tag' })
  updateTag(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateTag(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete tag' })
  deleteTag(@Param('id') id: string) {
    return this.contentService.deleteTag(id);
  }
}
