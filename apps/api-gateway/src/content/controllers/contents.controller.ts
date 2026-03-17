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

@ApiTags('Content / Contents')
@Controller('contents')
export class ContentsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get content list' })
  getContents(@Query() query: Record<string, any>) {
    return this.contentService.getContents(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get content detail by ID' })
  getContentById(@Param('id') id: string) {
    return this.contentService.getContentById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create content metadata' })
  createContent(@Body() body: Record<string, any>) {
    return this.contentService.createContent(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update content metadata' })
  updateContent(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateContent(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete content metadata' })
  deleteContent(@Param('id') id: string) {
    return this.contentService.deleteContent(id);
  }
}
