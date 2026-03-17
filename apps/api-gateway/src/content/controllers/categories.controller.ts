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

@ApiTags('Content / Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get categories list' })
  getCategories(@Query() query: Record<string, any>) {
    return this.contentService.getCategories(query);
  }

  @Public()
  @Get('tv-series-count')
  @ApiOperation({ summary: 'Get categories with TV series count' })
  getCategoriesWithTvSeriesCount() {
    return this.contentService.getCategoriesWithTvSeriesCount();
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search categories' })
  searchCategories(@Query('q') q: string) {
    return this.contentService.searchCategories(q || '');
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get category detail by ID' })
  getCategoryById(@Param('id') id: string) {
    return this.contentService.getCategoryById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create category' })
  createCategory(@Body() body: Record<string, any>) {
    return this.contentService.createCategory(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update category' })
  updateCategory(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.contentService.updateCategory(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete category' })
  deleteCategory(@Param('id') id: string) {
    return this.contentService.deleteCategory(id);
  }
}
