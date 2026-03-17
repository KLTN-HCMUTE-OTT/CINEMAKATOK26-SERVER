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

@ApiTags('Content / Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get videos list' })
  getVideos(@Query() query: Record<string, any>) {
    return this.contentService.getVideos(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get video detail by ID' })
  getVideoById(@Param('id') id: string) {
    return this.contentService.getVideoById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create video' })
  createVideo(@Body() body: Record<string, any>) {
    return this.contentService.createVideo(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update video' })
  updateVideo(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateVideo(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete video' })
  deleteVideo(@Param('id') id: string) {
    return this.contentService.deleteVideo(id);
  }
}
