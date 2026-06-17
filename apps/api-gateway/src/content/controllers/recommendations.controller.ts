import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { UserSession } from '@app/common/decorators/userSession.decorator';
import { JwtAuthGuard } from '@app/common/guards';
import { ApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';
import { MovieDto } from '@app/common/dtos/content/movies.dto';
import { TVSeriesSummaryDto } from '@app/common/dtos/content/tvseries.dto';
import { RecommendationResponseDataDto } from '@app/common/dtos/content/recommendation.dto';

import { ContentService } from '../content.service';

@ApiTags('Content / Recommendations')
@Controller('recommendations')
@ApiBearerAuth('access-token')
export class RecommendationsController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get personalized recommendations for the logged-in user',
    description:
      'Calls AI recommendation engine (FastAPI) to get personalized movie & TV series suggestions. ' +
      'Fallback to trending content if the AI service is unavailable.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of recommendations to return (default: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'List of recommended movies and TV series',
    type: ApiResponseDto(RecommendationResponseDataDto),
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  async getRecommendations(
    @UserSession('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    const result = await firstValueFrom(
      this.contentService.getRecommendationsForUser(
        userId,
        limit ? Number(limit) : undefined,
      ),
    );

    return ResponseBuilder.createResponse({
      data: {
        recommendations: this._transformItems(result.data || []),
        total: result.total,
        source: result.source,
      },
      message: 'Recommendations retrieved successfully',
    });
  }

  private _transformItems(items: any[]) {
    return items.map((entry) => ({
      rank: entry.rank,
      lgbScore: entry.lgbScore,
      type: entry.type,
      item:
        entry.type === 'MOVIE'
          ? plainToInstance(MovieDto, entry.item, {
              excludeExtraneousValues: true,
            })
          : plainToInstance(TVSeriesSummaryDto, entry.item, {
              excludeExtraneousValues: true,
            }),
    }));
  }
}
