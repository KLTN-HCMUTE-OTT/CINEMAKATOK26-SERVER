import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

import { ContentType, EntityContent } from '../entities/content.entity';
import { EntityMovie } from '../entities/movie.entity';
import { EntityTVSeries } from '../entities/tvseries.entity';
import { VideoService } from './video.service';

// ─── FastAPI Response Types ─────────────────────────────────────────────────────

interface FastApiRecommendationItem {
  itemid: string;
  lgb_score: number;
  title: string;
  type: 'MOVIE' | 'TVSERIES';
}

interface FastApiResponse {
  user_id: string;
  model: string;
  recommendations: FastApiRecommendationItem[];
}

// ─── Internal unified item type (returned to gateway) ───────────────────────────

export interface RecommendationItem {
  /** Original ranking position from the AI model (0-based) */
  rank: number;
  /** AI model score */
  lgbScore: number;
  /** 'MOVIE' | 'TVSERIES' */
  type: ContentType;
  /** The full entity fetched from our DB */
  item: EntityMovie | EntityTVSeries;
}

export interface RecommendationResult {
  data: RecommendationItem[];
  total: number;
  /** Tells the frontend where the data came from */
  source: 'ai_recommendation' | 'fallback_trending';
}

// ─── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class RecommendService {
  private readonly logger = new Logger(RecommendService.name);
  private readonly recommendApiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(EntityMovie, 'content')
    private readonly movieRepository: Repository<EntityMovie>,
    @InjectRepository(EntityTVSeries, 'content')
    private readonly tvSeriesRepository: Repository<EntityTVSeries>,
  ) {
    this.recommendApiUrl =
      this.configService.get<string>('RECOMMENDATION_API_URL') || '';
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Lấy danh sách gợi ý (movies + tvseries) cho user từ FastAPI.
   * Nếu FastAPI lỗi / timeout → fallback sang trending.
   */
  async getRecommendationsForUser(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendationResult> {
    try {
      const recommendations = await this._fetchRecommendations(userId, limit);

      if (!recommendations.length) {
        this.logger.warn(
          `FastAPI returned empty recommendations for user ${userId}, falling back`,
        );
        return this._getFallbackRecommendations(limit);
      }

      // Tách danh sách theo type
      const movieIds = recommendations
        .filter((r) => r.type === 'MOVIE')
        .map((r) => r.itemid);

      const tvSeriesIds = recommendations
        .filter((r) => r.type === 'TVSERIES')
        .map((r) => r.itemid);

      // Truy vấn song song cả 2 bảng
      const [movies, tvSeriesList] = await Promise.all([
        this._getMoviesByIds(movieIds),
        this._getTvSeriesByIds(tvSeriesIds),
      ]);

      // Gộp kết quả + sắp xếp đúng thứ tự ưu tiên từ FastAPI
      const data = this._mergeAndOrder(recommendations, movies, tvSeriesList);

      return {
        data,
        total: data.length,
        source: 'ai_recommendation',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recommendations from FastAPI for user ${userId}: ${error.message}`,
        error.stack,
      );
      return this._getFallbackRecommendations(limit);
    }
  }

  // ─── FastAPI Call ───────────────────────────────────────────────────────────

  /**
   * Gọi FastAPI Recommendation API, trả về raw recommendations.
   */
  private async _fetchRecommendations(
    userId: string,
    limit: number,
  ): Promise<FastApiRecommendationItem[]> {
    if (!this.recommendApiUrl) {
      throw new Error('RECOMMENDATION_API_URL is not configured');
    }

    const url = `${this.recommendApiUrl}/recommend/${userId}?top_n=${limit}`;
    this.logger.log(`Calling FastAPI recommendation: ${url}`);

    const response = await firstValueFrom(
      this.httpService.get<FastApiResponse>(url).pipe(
        timeout(5000),
        catchError((err) => {
          if (err.name === 'TimeoutError') {
            throw new Error(
              `FastAPI recommendation timeout after 5000ms for user ${userId}`,
            );
          }
          const status = err.response?.status || 'unknown';
          const detail = err.response?.data?.detail || err.message;
          throw new Error(
            `FastAPI recommendation failed [${status}]: ${detail}`,
          );
        }),
      ),
    );

    return response.data?.recommendations || [];
  }

  // ─── DB Queries ─────────────────────────────────────────────────────────────

  /**
   * Lấy đầy đủ thông tin movie từ danh sách movies.id
   */
  private async _getMoviesByIds(movieIds: string[]): Promise<EntityMovie[]> {
    if (!movieIds.length) return [];

    return this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors')
      .where('movie.id IN (:...movieIds)', { movieIds })
      .getMany();
  }

  /**
   * Lấy đầy đủ thông tin tvseries từ danh sách tvseries.id
   */
  private async _getTvSeriesByIds(
    tvSeriesIds: string[],
  ): Promise<EntityTVSeries[]> {
    if (!tvSeriesIds.length) return [];

    return this.tvSeriesRepository
      .createQueryBuilder('tvseries')
      .leftJoinAndSelect('tvseries.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors')
      .loadRelationCountAndMap('tvseries.totalSeasons', 'tvseries.seasons')
      .where('tvseries.id IN (:...tvSeriesIds)', { tvSeriesIds })
      .getMany();
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Gộp movies + tvseries rồi sắp xếp theo đúng thứ tự ưu tiên
   * (thứ tự gốc từ FastAPI đã được sắp theo lgb_score DESC).
   */
  private _mergeAndOrder(
    recommendations: FastApiRecommendationItem[],
    movies: EntityMovie[],
    tvSeriesList: EntityTVSeries[],
  ): RecommendationItem[] {
    const movieMap = new Map(movies.map((m) => [m.id, m]));
    const tvSeriesMap = new Map(tvSeriesList.map((tv) => [tv.id, tv]));

    return recommendations
      .map((rec, index) => {
        const item =
          rec.type === 'MOVIE'
            ? movieMap.get(rec.itemid)
            : tvSeriesMap.get(rec.itemid);

        if (!item) return null;

        return {
          rank: index,
          lgbScore: rec.lgb_score,
          type:
            rec.type === 'MOVIE'
              ? ContentType.MOVIE
              : ContentType.TVSERIES,
          item,
        } as RecommendationItem;
      })
      .filter((entry): entry is RecommendationItem => entry !== null);
  }

  // ─── Fallback ───────────────────────────────────────────────────────────────

  /**
   * Fallback: Trả về mix trending movies + tvseries khi FastAPI không khả dụng.
   */
  private async _getFallbackRecommendations(
    limit: number,
  ): Promise<RecommendationResult> {
    this.logger.warn(
      'Using fallback: fetching trending movies + tvseries from local DB',
    );

    const halfLimit = Math.ceil(limit / 2);
    const epoch = new Date('2020-01-01T00:00:00Z').getTime() / 1000;

    const movieHotness = `
      LOG(10, COALESCE(metaData.viewCount, 0) + COALESCE(metaData.avgRating, 0) * 100 + 1) +
      ((EXTRACT(EPOCH FROM movie.createdAt) - ${epoch}) / 45000)
    `;

    const tvHotness = `
      LOG(10, COALESCE(metaData.viewCount, 0) + COALESCE(metaData.avgRating, 0) * 100 + 1) +
      ((EXTRACT(EPOCH FROM tvseries.createdAt) - ${epoch}) / 45000)
    `;

    const [movies, tvSeriesList] = await Promise.all([
      this.movieRepository
        .createQueryBuilder('movie')
        .leftJoinAndSelect('movie.metaData', 'metaData')
        .leftJoinAndSelect('metaData.categories', 'categories')
        .leftJoinAndSelect('metaData.tags', 'tags')
        .leftJoinAndSelect('metaData.actors', 'actors')
        .leftJoinAndSelect('metaData.directors', 'directors')
        .addSelect(movieHotness, 'hotness')
        .orderBy('hotness', 'DESC')
        .take(halfLimit)
        .getMany(),

      this.tvSeriesRepository
        .createQueryBuilder('tvseries')
        .leftJoinAndSelect('tvseries.metaData', 'metaData')
        .leftJoinAndSelect('metaData.categories', 'categories')
        .leftJoinAndSelect('metaData.tags', 'tags')
        .leftJoinAndSelect('metaData.actors', 'actors')
        .leftJoinAndSelect('metaData.directors', 'directors')
        .loadRelationCountAndMap('tvseries.totalSeasons', 'tvseries.seasons')
        .addSelect(tvHotness, 'hotness')
        .orderBy('hotness', 'DESC')
        .take(halfLimit)
        .getMany(),
    ]);

    // Interleave: movie, tvseries, movie, tvseries, ...
    const data: RecommendationItem[] = [];
    const maxLen = Math.max(movies.length, tvSeriesList.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < movies.length) {
        data.push({
          rank: data.length,
          lgbScore: 0,
          type: ContentType.MOVIE,
          item: movies[i],
        });
      }
      if (i < tvSeriesList.length) {
        data.push({
          rank: data.length,
          lgbScore: 0,
          type: ContentType.TVSERIES,
          item: tvSeriesList[i],
        });
      }
    }

    return {
      data: data.slice(0, limit),
      total: data.length,
      source: 'fallback_trending',
    };
  }
}
