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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';

import { Public } from '@app/common/decorators/public.decorator';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';
import { ResponseBuilder } from '@app/common/utils/dto';
import { plainToInstance } from 'class-transformer';
import { ContentService } from '../content.service';
import {
  ActorContentDto,
  ActorDto,
  CreateActorDto,
  UpdateActorDto,
} from '@app/common/dtos/content/actor.dto';

@ApiTags('Content / Actors')
@Controller('actors')
export class ActorsController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all actors' })
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
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order for actors',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search actors by name or nationality',
  })
  async getActors(@Query() query: Record<string, any>) {
    const result = await firstValueFrom(this.contentService.getActors(query));
    const actors = result?.data ?? [];
    const total = result?.total ?? 0;

    return ResponseBuilder.createPaginatedResponse({
      data: actors.map((actor: any) =>
        plainToInstance(ActorDto, actor, { excludeExtraneousValues: true }),
      ),
      totalItems: total,
      currentPage: Number(query?.page) || 1,
      itemsPerPage: Number(query?.limit) || 10,
      message: 'Actors retrieved successfully',
    });
  }

  @Public()
  @Get('top')
  @ApiOperation({ summary: 'Get top actors by number of contents' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getTopActors(@Query() query: Record<string, any>) {
    const result = await firstValueFrom(
      this.contentService.getTopActors(query),
    );
    const actors = result?.data ?? [];
    const total = result?.total ?? 0;

    return ResponseBuilder.createPaginatedResponse({
      data: actors.map((actor: any) => ({
        ...plainToInstance(ActorDto, actor, { excludeExtraneousValues: true }),
        contentCount: actor.contentCount || 0,
      })),
      totalItems: total,
      currentPage: Number(query?.page) || 1,
      itemsPerPage: Number(query?.limit) || 10,
      message: 'Top actors retrieved successfully',
    });
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search actors' })
  async searchActors(@Query('q') q: string) {
    const actors = await firstValueFrom(
      this.contentService.searchActors(q || ''),
    );

    return ResponseBuilder.createResponse({
      data: (actors || []).map((actor: any) =>
        plainToInstance(ActorDto, actor, { excludeExtraneousValues: true }),
      ),
      message: 'Actors retrieved successfully',
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get an actor by ID with all contents' })
  @ApiParam({
    name: 'id',
    description: 'Actor ID',
    type: String,
  })
  async getActorById(@Param('id') id: string) {
    const actor = await firstValueFrom(this.contentService.getActorById(id));

    const actorDetail = {
      ...plainToInstance(ActorDto, actor, { excludeExtraneousValues: true }),
      contents:
        actor?.contents?.map((content: any) =>
          plainToInstance(
            ActorContentDto,
            {
              id: content.movieOrSeriesId,
              contentId: content.id,
              type: content.type,
              title: content.title,
              description: content.description,
              thumbnail: content.thumbnail,
              releaseDate: content.releaseDate,
              rating: content.rating,
              duration: content.duration,
              role: content.role,
            },
            { excludeExtraneousValues: true },
          ),
        ) || [],
      contentCount: actor?.contents?.length || 0,
    };

    return ResponseBuilder.createResponse({
      message: 'Actor retrieved successfully',
      data: actorDetail,
    });
  }

  @Post()
  //@UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Create actor' })
  async createActor(@Body() createActorDto: CreateActorDto) {
    const actor = await firstValueFrom(
      this.contentService.createActor(createActorDto),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(ActorDto, actor, { excludeExtraneousValues: true }),
      message: 'Actor created successfully',
    });
  }

  @Patch(':id')
  //@UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Update actor' })
  @ApiParam({
    name: 'id',
    description: 'Actor ID',
    type: String,
  })
  async updateActor(@Param('id') id: string, @Body() body: UpdateActorDto) {
    const actor = await firstValueFrom(
      this.contentService.updateActor(id, body),
    );

    return ResponseBuilder.createResponse({
      message: 'Actor updated successfully',
      data: plainToInstance(ActorDto, actor, { excludeExtraneousValues: true }),
    });
  }

  @Delete(':id')
  //@UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] Delete actor' })
  @ApiParam({
    name: 'id',
    description: 'Actor ID',
    type: String,
  })
  async deleteActor(@Param('id') id: string) {
    await this.contentService.deleteActor(id);

    return ResponseBuilder.createResponse({
      message: 'Actor deleted successfully',
      data: null,
    });
  }
}
