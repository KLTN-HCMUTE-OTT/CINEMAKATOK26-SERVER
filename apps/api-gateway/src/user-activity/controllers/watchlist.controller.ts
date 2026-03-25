import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';

import { UserSession } from '@app/common/decorators';
import { JwtAuthGuard } from '@app/common/guards';
import { ResponseBuilder } from '@app/common/utils/dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { CreateWatchListDto } from '@app/common/dtos/user-activity/watchlist.dto';

import { WatchListService } from '../services/watchlist.service';

@ApiTags('User Activity / WatchList')
@Controller('watchlist')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class WatchListController {
  constructor(private readonly watchListService: WatchListService) {}

  @Post()
  @ApiOperation({ summary: 'Add content to watchlist' })
  async addToWatchList(
    @UserSession('id') userId: string,
    @Body() createWatchListDto: CreateWatchListDto,
  ) {
    const watchListItem = await firstValueFrom(
      this.watchListService.addToWatchList(
        userId,
        createWatchListDto.contentId,
      ),
    );

    return ResponseBuilder.createResponse({
      message: 'Content added to watchlist successfully',
      data: watchListItem,
    });
  }

  @Delete(':contentId')
  @ApiOperation({ summary: 'Remove content from watchlist' })
  @ApiParam({
    name: 'contentId',
    description: 'Content ID to remove',
    type: String,
  })
  async removeFromWatchList(
    @UserSession('id') userId: string,
    @Param('contentId') contentId: string,
  ) {
    await firstValueFrom(
      this.watchListService.removeFromWatchList(userId, contentId),
    );

    return ResponseBuilder.createResponse({
      message: 'Content removed from watchlist successfully',
      data: null,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get user watchlist' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  async getUserWatchList(
    @UserSession('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, total } = await firstValueFrom(
      this.watchListService.getUserWatchList(userId, query),
    );

    return ResponseBuilder.createPaginatedResponse({
      data,
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Watchlist retrieved successfully',
    });
  }

  @Get('check/:contentId')
  @ApiOperation({ summary: 'Check if content is in watchlist by content ID' })
  @ApiParam({
    name: 'contentId',
    description: 'Content ID to check',
    type: String,
  })
  async checkInWatchList(
    @UserSession('id') userId: string,
    @Param('contentId') contentId: string,
  ) {
    const isInWatchList = await firstValueFrom(
      this.watchListService.checkInWatchList(userId, contentId),
    );

    return ResponseBuilder.createResponse({
      message: 'Check completed',
      data: { isInWatchList },
    });
  }

  @Get('check-movie/:movieId')
  @ApiOperation({
    summary: 'Check if movie/tvseries is in watchlist by movie/tvseries ID',
  })
  @ApiParam({
    name: 'movieId',
    description: 'Movie ID or TVSeries ID to check',
    type: String,
  })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['MOVIE', 'TVSERIES'],
    description: 'Type of content (MOVIE or TVSERIES)',
  })
  async checkInWatchListByMovieId(
    @UserSession('id') userId: string,
    @Param('movieId') movieId: string,
    @Query('type') type: 'MOVIE' | 'TVSERIES',
  ) {
    const isInWatchList = await firstValueFrom(
      this.watchListService.checkInWatchListByMovieId(userId, movieId, type),
    );

    return ResponseBuilder.createResponse({
      message: 'Check completed',
      data: { isInWatchList },
    });
  }

  @Get('favourite-count/:contentId')
  @ApiOperation({
    summary: 'Get count of users who added content to favourites',
  })
  @ApiParam({
    name: 'contentId',
    description: 'Content ID',
    type: String,
  })
  async getFavouriteCount(@Param('contentId') contentId: string) {
    const count = await firstValueFrom(
      this.watchListService.getFavouriteCount(contentId),
    );

    return ResponseBuilder.createResponse({
      message: 'Favourite count retrieved successfully',
      data: { count },
    });
  }
}
