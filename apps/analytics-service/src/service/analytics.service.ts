import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { firstValueFrom } from 'rxjs';

import { LOG_ACTION } from '@app/common/enums/log.enum';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

type TrendDirection = 'up' | 'down';
type SortDirection = 'ASC' | 'DESC';

type AuditLogRecord = {
  userId?: string;
  action?: LOG_ACTION;
  resourceId?: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | string;
};

type SortSpec = {
  key: string;
  direction: SortDirection;
};

type ViewForecastRecord = {
  contentId: string;
  title: string;
  contentType: string;
  historyViews: Array<{ day: string; views: number }>;
  last7Avg: number;
  next7DaysViews: number[];
  totalForecast7d: number;
  predictedTrend: 'up' | 'down';
  mae: number | null;
  mape: number | null;
};

type ChurnFeatureRecord = {
  userId: string;
  accountAgeDays: number;
  daysSinceLastActivity: number;
  watchProgressCount30d: number;
  watchedDuration30d: number;
  completedVideos30d: number;
  watchlistAdds30d: number;
  favoriteAdds30d: number;
  reviews30d: number;
  auditEvents30d: number;
};

type ChurnPredictionRecord = {
  userId: string;
  name: string;
  email: string | null;
  churnProbability: number;
  returnProbability: number;
  riskLevel: 'high' | 'medium' | 'low';
  features: ChurnFeatureRecord;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
    @Inject('AUDIT_LOG_SERVICE') private readonly auditClient: ClientProxy,
  ) {}

  private readonly engagementActions: LOG_ACTION[] = [
    LOG_ACTION.LIKE_MOVIE,
    LOG_ACTION.UNLIKE_MOVIE,
    LOG_ACTION.ADD_MOVIE_TO_WATCHLIST,
    LOG_ACTION.REMOVE_MOVIE_FROM_WATCHLIST,
    LOG_ACTION.PLAY_MOVIE,
    LOG_ACTION.LIKE_SERIES,
    LOG_ACTION.UNLIKE_SERIES,
    LOG_ACTION.ADD_SERIES_TO_WATCHLIST,
    LOG_ACTION.REMOVE_SERIES_FROM_WATCHLIST,
    LOG_ACTION.PLAY_EPISODE_OF_SERIES,
    LOG_ACTION.CREATE_REVIEW,
    LOG_ACTION.UPDATE_REVIEW,
    LOG_ACTION.DELETE_REVIEW,
    LOG_ACTION.CONTENT_VIEW_INCREASED,
  ];

  private readonly viewIncreaseAction = LOG_ACTION.CONTENT_VIEW_INCREASED;

  private toDate(input?: Date | string): Date | null {
    if (!input) {
      return null;
    }

    const value = input instanceof Date ? input : new Date(input);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  private parseSort(sort?: unknown): SortSpec | null {
    if (!sort) {
      return null;
    }

    try {
      const parsed = typeof sort === 'string' ? JSON.parse(sort) : sort;
      const key = Object.keys(parsed || {})[0];
      if (!key) {
        return null;
      }

      const rawDirection = String(
        (parsed as Record<string, unknown>)[key] || 'DESC',
      ).toUpperCase();
      return {
        key,
        direction: rawDirection === 'ASC' ? 'ASC' : 'DESC',
      };
    } catch {
      return null;
    }
  }

  private parseSearch(search?: unknown): string {
    if (!search) {
      return '';
    }

    if (typeof search !== 'string') {
      return String(search).toLowerCase();
    }

    const trimmed = search.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const firstValue = Object.values(parsed)[0];
      return firstValue ? String(firstValue).toLowerCase() : '';
    } catch {
      return trimmed.toLowerCase();
    }
  }

  private parseChangeToNumber(change: string): number {
    const match = change.match(/([+-]?\d+\.?\d*)%/);
    return match ? Number.parseFloat(match[1]) : 0;
  }

  private formatChangePercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  private paginate<T>(
    items: T[],
    query: PaginationQueryDto,
  ): { data: T[]; total: number; page: number; limit: number } {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      data: items.slice(startIndex, endIndex),
      total: items.length,
      page,
      limit,
    };
  }

  private isContentMatched(log: AuditLogRecord, contentId: string): boolean {
    if (log.resourceId === contentId) {
      return true;
    }

    const metadata = log.metadata;
    if (metadata && typeof metadata === 'object') {
      const metadataContentId = (metadata as Record<string, unknown>).contentId;
      return metadataContentId === contentId;
    }

    return false;
  }

  private countDistinctUsers(
    logs: AuditLogRecord[],
    predicate?: (log: AuditLogRecord) => boolean,
  ): number {
    const ids = new Set<string>();
    for (const log of logs) {
      if (!log.userId) {
        continue;
      }
      if (predicate && !predicate(log)) {
        continue;
      }
      ids.add(log.userId);
    }
    return ids.size;
  }

  private applySearch<T extends { title?: string }>(
    items: T[],
    query: PaginationQueryDto,
  ): T[] {
    const searchTerm = this.parseSearch(query.search);
    if (!searchTerm) {
      return items;
    }

    return items.filter((item) =>
      (item.title || '').toLowerCase().includes(searchTerm),
    );
  }

  private sortStats<
    T extends { title?: string; views: number; change: string },
  >(items: T[], query: PaginationQueryDto): T[] {
    const sorted = [...items];
    const sort = this.parseSort(query.sort);

    if (!sort) {
      sorted.sort(
        (a, b) =>
          this.parseChangeToNumber(b.change) -
          this.parseChangeToNumber(a.change),
      );
      return sorted;
    }

    const direction = sort.direction === 'DESC' ? 1 : -1;

    if (sort.key === 'change') {
      sorted.sort(
        (a, b) =>
          direction *
          (this.parseChangeToNumber(b.change) -
            this.parseChangeToNumber(a.change)),
      );
      return sorted;
    }

    if (sort.key === 'views') {
      sorted.sort((a, b) => direction * (b.views - a.views));
      return sorted;
    }

    if (sort.key === 'title') {
      sorted.sort(
        (a, b) => direction * (b.title || '').localeCompare(a.title || ''),
      );
      return sorted;
    }

    return sorted;
  }

  private sortTrending<
    T extends {
      title: string;
      views: number;
      rating: number;
      change: string;
      engagement: number;
    },
  >(items: T[], query: PaginationQueryDto): T[] {
    const sorted = [...items];
    const sort = this.parseSort(query.sort);

    if (!sort) {
      sorted.sort(
        (a, b) =>
          b.engagement +
          this.parseChangeToNumber(b.change) -
          (a.engagement + this.parseChangeToNumber(a.change)),
      );
      return sorted;
    }

    const direction = sort.direction === 'DESC' ? 1 : -1;

    if (sort.key === 'change') {
      sorted.sort(
        (a, b) =>
          direction *
          (this.parseChangeToNumber(b.change) -
            this.parseChangeToNumber(a.change)),
      );
      return sorted;
    }

    if (sort.key === 'engagement') {
      sorted.sort((a, b) => direction * (b.engagement - a.engagement));
      return sorted;
    }

    if (sort.key === 'views') {
      sorted.sort((a, b) => direction * (b.views - a.views));
      return sorted;
    }

    if (sort.key === 'rating') {
      sorted.sort((a, b) => direction * (b.rating - a.rating));
      return sorted;
    }

    if (sort.key === 'title') {
      sorted.sort((a, b) => direction * b.title.localeCompare(a.title));
      return sorted;
    }

    return sorted;
  }

  private sortForecast(
    items: ViewForecastRecord[],
    query: PaginationQueryDto,
  ): ViewForecastRecord[] {
    const sorted = [...items];
    const sort = this.parseSort(query.sort);

    if (!sort) {
      sorted.sort((a, b) => b.totalForecast7d - a.totalForecast7d);
      return sorted;
    }

    const direction = sort.direction === 'DESC' ? 1 : -1;

    if (sort.key === 'totalForecast7d') {
      sorted.sort(
        (a, b) => direction * (b.totalForecast7d - a.totalForecast7d),
      );
      return sorted;
    }

    if (sort.key === 'last7Avg') {
      sorted.sort((a, b) => direction * (b.last7Avg - a.last7Avg));
      return sorted;
    }

    if (sort.key === 'title') {
      sorted.sort((a, b) => direction * b.title.localeCompare(a.title));
      return sorted;
    }

    return sorted;
  }

  private applyChurnSearch(
    items: ChurnPredictionRecord[],
    query: PaginationQueryDto,
  ): ChurnPredictionRecord[] {
    const searchTerm = this.parseSearch(query.search);
    if (!searchTerm) {
      return items;
    }

    return items.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const email = (item.email || '').toLowerCase();
      const userId = (item.userId || '').toLowerCase();
      return (
        name.includes(searchTerm) ||
        email.includes(searchTerm) ||
        userId.includes(searchTerm)
      );
    });
  }

  private sortChurnPrediction(
    items: ChurnPredictionRecord[],
    query: PaginationQueryDto,
  ): ChurnPredictionRecord[] {
    const sorted = [...items];
    const sort = this.parseSort(query.sort);

    if (!sort) {
      sorted.sort((a, b) => b.churnProbability - a.churnProbability);
      return sorted;
    }

    const direction = sort.direction === 'DESC' ? 1 : -1;

    if (sort.key === 'churnProbability') {
      sorted.sort(
        (a, b) => direction * (b.churnProbability - a.churnProbability),
      );
      return sorted;
    }

    if (sort.key === 'returnProbability') {
      sorted.sort(
        (a, b) => direction * (b.returnProbability - a.returnProbability),
      );
      return sorted;
    }

    if (sort.key === 'daysSinceLastActivity') {
      sorted.sort(
        (a, b) =>
          direction *
          (b.features.daysSinceLastActivity - a.features.daysSinceLastActivity),
      );
      return sorted;
    }

    if (sort.key === 'name') {
      sorted.sort((a, b) => direction * b.name.localeCompare(a.name));
      return sorted;
    }

    return sorted;
  }

  private async fetchAllContent<T>(command: string): Promise<T[]> {
    const allItems: T[] = [];
    const limit = 200;
    let page = 1;
    let total = 0;

    do {
      const response = await firstValueFrom(
        this.contentClient.send<
          { data: T[]; total: number },
          Record<string, number>
        >({ cmd: command }, { page, limit }),
      );

      const batch = response?.data || [];
      total = response?.total || 0;
      allItems.push(...batch);
      page += 1;
    } while (allItems.length < total);

    return allItems;
  }

  private async fetchAllAuditLogs(): Promise<AuditLogRecord[]> {
    const allLogs: AuditLogRecord[] = [];
    const limit = 500;
    let page = 1;
    let total = 0;

    do {
      const response = await firstValueFrom(
        this.auditClient.send<
          { result: AuditLogRecord[]; total: number },
          Record<string, number>
        >({ cmd: 'get_audit_logs' }, { page, limit }),
      );

      const batch = response?.result || [];
      total = response?.total || 0;
      allLogs.push(...batch);
      page += 1;
    } while (allLogs.length < total);

    return allLogs;
  }

  private calculateTrending(
    contentId: string,
    logs: AuditLogRecord[],
  ): { trending: TrendDirection; change: string } {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentViews = logs.filter((log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        log.action === this.viewIncreaseAction &&
        this.isContentMatched(log, contentId) &&
        createdAt >= sevenDaysAgo
      );
    }).length;

    const previousViews = logs.filter((log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        log.action === this.viewIncreaseAction &&
        this.isContentMatched(log, contentId) &&
        createdAt >= fourteenDaysAgo &&
        createdAt < sevenDaysAgo
      );
    }).length;

    let changePercent = 0;
    if (previousViews > 0) {
      changePercent = ((recentViews - previousViews) / previousViews) * 100;
    }

    return {
      trending: changePercent >= 0 ? 'up' : 'down',
      change: this.formatChangePercent(changePercent),
    };
  }

  private calculateCategoryTrending(
    contentIds: string[],
    logs: AuditLogRecord[],
  ): { trending: TrendDirection; change: string } {
    if (!contentIds.length) {
      return { trending: 'up', change: '+0.0%' };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const idSet = new Set(contentIds);

    const recentViews = logs.filter((log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        log.action === this.viewIncreaseAction &&
        ((log.resourceId && idSet.has(log.resourceId)) || false) &&
        createdAt >= sevenDaysAgo
      );
    }).length;

    const previousViews = logs.filter((log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        log.action === this.viewIncreaseAction &&
        ((log.resourceId && idSet.has(log.resourceId)) || false) &&
        createdAt >= fourteenDaysAgo &&
        createdAt < sevenDaysAgo
      );
    }).length;

    let changePercent = 0;
    if (previousViews > 0) {
      changePercent = ((recentViews - previousViews) / previousViews) * 100;
    }

    return {
      trending: changePercent >= 0 ? 'up' : 'down',
      change: this.formatChangePercent(changePercent),
    };
  }

  private calculateEngagement(
    contentId: string,
    logs: AuditLogRecord[],
  ): number {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const contentEngagementCount = logs.filter((log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        createdAt >= sevenDaysAgo &&
        !!log.action &&
        this.engagementActions.includes(log.action) &&
        this.isContentMatched(log, contentId)
      );
    }).length;

    const totalEngagementCount = logs.filter((log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        createdAt >= sevenDaysAgo &&
        !!log.action &&
        this.engagementActions.includes(log.action)
      );
    }).length;

    if (totalEngagementCount === 0) {
      return 0;
    }

    return Math.round((contentEngagementCount / totalEngagementCount) * 100);
  }

  async getMoviesStats(query: PaginationQueryDto): Promise<{
    data: Array<{
      id: string;
      title: string;
      views: number;
      trending: TrendDirection;
      change: string;
      percentage: number;
    }>;
    total: number;
  }> {
    const [movies, logs] = await Promise.all([
      this.fetchAllContent<Record<string, any>>('content.getMovies'),
      this.fetchAllAuditLogs(),
    ]);

    const stats = movies.map((movie) => {
      const contentId = movie?.metaData?.id as string;
      const trendingData = this.calculateTrending(contentId, logs);
      return {
        id: String(movie?.id || ''),
        title: String(movie?.metaData?.title || 'Unknown'),
        views: Number(movie?.metaData?.viewCount || 0),
        trending: trendingData.trending,
        change: trendingData.change,
        percentage: 0,
      };
    });

    const searched = this.applySearch(stats, query);
    const sorted = this.sortStats(searched, query);
    const paginated = this.paginate(sorted, query);

    const totalViews = paginated.data.reduce(
      (sum, item) => sum + item.views,
      0,
    );
    const data = paginated.data.map((item) => ({
      ...item,
      percentage:
        totalViews > 0 ? Math.round((item.views / totalViews) * 100) : 0,
    }));

    return { data, total: paginated.total };
  }

  async getTVSeriesStats(query: PaginationQueryDto): Promise<{
    data: Array<{
      id: string;
      title: string;
      views: number;
      trending: TrendDirection;
      change: string;
      percentage: number;
    }>;
    total: number;
  }> {
    const [tvSeries, logs] = await Promise.all([
      this.fetchAllContent<Record<string, any>>('content.getTvSeries'),
      this.fetchAllAuditLogs(),
    ]);

    const stats = tvSeries.map((series) => {
      const contentId = series?.metaData?.id as string;
      const trendingData = this.calculateTrending(contentId, logs);
      return {
        id: String(series?.id || ''),
        title: String(series?.metaData?.title || 'Unknown'),
        views: Number(series?.metaData?.viewCount || 0),
        trending: trendingData.trending,
        change: trendingData.change,
        percentage: 0,
      };
    });

    const searched = this.applySearch(stats, query);
    const sorted = this.sortStats(searched, query);
    const paginated = this.paginate(sorted, query);

    const totalViews = paginated.data.reduce(
      (sum, item) => sum + item.views,
      0,
    );
    const data = paginated.data.map((item) => ({
      ...item,
      percentage:
        totalViews > 0 ? Math.round((item.views / totalViews) * 100) : 0,
    }));

    return { data, total: paginated.total };
  }

  async getCategoriesStats(query: PaginationQueryDto): Promise<{
    data: Array<{
      id: string;
      title: string;
      views: number;
      trending: TrendDirection;
      change: string;
      percentage: number;
    }>;
    total: number;
  }> {
    const [categories, logs] = await Promise.all([
      this.fetchAllContent<Record<string, any>>('content.getCategories'),
      this.fetchAllAuditLogs(),
    ]);

    const stats = categories.map((category) => {
      const contents = Array.isArray(category?.contents)
        ? category.contents
        : [];
      const contentIds = contents
        .map((content: Record<string, any>) => String(content?.id || ''))
        .filter(Boolean);
      const views = contents.reduce(
        (sum: number, content: Record<string, any>) =>
          sum + Number(content?.viewCount || 0),
        0,
      );
      const trendingData = this.calculateCategoryTrending(contentIds, logs);

      return {
        id: String(category?.id || ''),
        title: String(category?.categoryName || 'Unknown'),
        views,
        trending: trendingData.trending,
        change: trendingData.change,
        percentage: 0,
      };
    });

    const searched = this.applySearch(stats, query);
    const sorted = this.sortStats(searched, query);
    const paginated = this.paginate(sorted, query);

    const totalViews = paginated.data.reduce(
      (sum, item) => sum + item.views,
      0,
    );

    const data = paginated.data.map((item) => ({
      ...item,
      percentage:
        totalViews > 0 ? Math.round((item.views / totalViews) * 100) : 0,
    }));

    return { data, total: paginated.total };
  }

  async getTrendingMovies(query: PaginationQueryDto): Promise<{
    data: Array<{
      id: string;
      title: string;
      poster: string;
      rating: number;
      views: number;
      trend: TrendDirection;
      change: string;
      engagement: number;
    }>;
    total: number;
  }> {
    const [movies, logs] = await Promise.all([
      this.fetchAllContent<Record<string, any>>('content.getMovies'),
      this.fetchAllAuditLogs(),
    ]);

    const items = movies.map((movie) => {
      const contentId = String(movie?.metaData?.id || '');
      const trendingData = this.calculateTrending(contentId, logs);
      return {
        id: String(movie?.id || ''),
        title: String(movie?.metaData?.title || 'Unknown'),
        poster: String(
          movie?.metaData?.thumbnail ||
            'https://via.placeholder.com/50x75?text=Movie',
        ),
        rating: Number(movie?.metaData?.avgRating || 0),
        views: Number(movie?.metaData?.viewCount || 0),
        trend: trendingData.trending,
        change: trendingData.change,
        engagement: this.calculateEngagement(contentId, logs),
      };
    });

    const searched = this.applySearch(items, query);
    const sorted = this.sortTrending(searched, query);
    const paginated = this.paginate(sorted, query);

    return { data: paginated.data, total: paginated.total };
  }

  async getTrendingTVSeries(query: PaginationQueryDto): Promise<{
    data: Array<{
      id: string;
      title: string;
      poster: string;
      rating: number;
      views: number;
      trend: TrendDirection;
      change: string;
      engagement: number;
    }>;
    total: number;
  }> {
    const [tvSeries, logs] = await Promise.all([
      this.fetchAllContent<Record<string, any>>('content.getTvSeries'),
      this.fetchAllAuditLogs(),
    ]);

    const items = tvSeries.map((series) => {
      const contentId = String(series?.metaData?.id || '');
      const trendingData = this.calculateTrending(contentId, logs);
      return {
        id: String(series?.id || ''),
        title: String(series?.metaData?.title || 'Unknown'),
        poster: String(
          series?.metaData?.thumbnail ||
            'https://via.placeholder.com/50x75?text=TV',
        ),
        rating: Number(series?.metaData?.avgRating || 0),
        views: Number(series?.metaData?.viewCount || 0),
        trend: trendingData.trending,
        change: trendingData.change,
        engagement: this.calculateEngagement(contentId, logs),
      };
    });

    const searched = this.applySearch(items, query);
    const sorted = this.sortTrending(searched, query);
    const paginated = this.paginate(sorted, query);

    return { data: paginated.data, total: paginated.total };
  }

  async getUserStats(): Promise<{
    summary: {
      totalUsers: number;
      activeUsers: number;
      newUsers: number;
      churnRate: number;
    };
    userMetrics: {
      dau: Array<{ day: string; users: number; trend: TrendDirection }>;
      mau: Array<{
        month: string;
        users: number;
        trend: TrendDirection;
        change: string;
      }>;
      churnRate: Array<{ month: string; rate: number; trend: TrendDirection }>;
    };
  }> {
    const logs = await this.fetchAllAuditLogs();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalUsers = this.countDistinctUsers(logs);

    const activeUsers = this.countDistinctUsers(logs, (log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        createdAt >= sevenDaysAgo &&
        !!log.action &&
        this.engagementActions.includes(log.action)
      );
    });

    const registrationActions = [
      LOG_ACTION.CREATE_USER,
      LOG_ACTION.USER_REGISTRATION,
    ];
    const newUsers = this.countDistinctUsers(logs, (log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        createdAt >= thirtyDaysAgo &&
        !!log.action &&
        registrationActions.includes(log.action)
      );
    });

    const churnedUsers = this.countDistinctUsers(logs, (log) => {
      const createdAt = this.toDate(log.createdAt);
      return (
        !!createdAt &&
        createdAt < thirtyDaysAgo &&
        log.action === LOG_ACTION.USER_LOGIN
      );
    });

    const churnRate = totalUsers > 0 ? (churnedUsers / totalUsers) * 100 : 0;

    const dau: Array<{ day: string; users: number; trend: TrendDirection }> =
      [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
      );

      const usersCount = this.countDistinctUsers(logs, (log) => {
        const createdAt = this.toDate(log.createdAt);
        return (
          !!createdAt &&
          createdAt >= startOfDay &&
          createdAt < endOfDay &&
          !!log.action &&
          this.engagementActions.includes(log.action)
        );
      });

      const prevUsers = dau.length > 0 ? dau[dau.length - 1].users : usersCount;
      dau.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        users: usersCount,
        trend: usersCount >= prevUsers ? 'up' : 'down',
      });
    }

    const mau: Array<{
      month: string;
      users: number;
      trend: TrendDirection;
      change: string;
    }> = [];
    const currentMonth = now.getMonth();
    for (let i = 0; i <= currentMonth; i += 1) {
      const monthStart = new Date(now.getFullYear(), i, 1);
      const monthEnd = new Date(now.getFullYear(), i + 1, 1);

      const usersCount = this.countDistinctUsers(logs, (log) => {
        const createdAt = this.toDate(log.createdAt);
        return (
          !!createdAt &&
          createdAt >= monthStart &&
          createdAt < monthEnd &&
          !!log.action &&
          this.engagementActions.includes(log.action)
        );
      });

      const prevUsers = mau.length > 0 ? mau[mau.length - 1].users : usersCount;
      const change =
        prevUsers > 0
          ? this.formatChangePercent(
              ((usersCount - prevUsers) / prevUsers) * 100,
            )
          : '+0.0%';
      mau.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'long' }),
        users: usersCount,
        trend: usersCount >= prevUsers ? 'up' : 'down',
        change,
      });
    }

    const churnRateMetrics: Array<{
      month: string;
      rate: number;
      trend: TrendDirection;
    }> = [];
    for (let i = 3; i >= 0; i -= 1) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const prevMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() - i - 1,
        1,
      );
      const prevMonthEnd = monthStart;

      const activeThisMonth = this.countDistinctUsers(logs, (log) => {
        const createdAt = this.toDate(log.createdAt);
        return (
          !!createdAt &&
          createdAt >= monthStart &&
          createdAt < monthEnd &&
          !!log.action &&
          this.engagementActions.includes(log.action)
        );
      });

      const activePrevMonth = this.countDistinctUsers(logs, (log) => {
        const createdAt = this.toDate(log.createdAt);
        return (
          !!createdAt &&
          createdAt >= prevMonthStart &&
          createdAt < prevMonthEnd &&
          !!log.action &&
          this.engagementActions.includes(log.action)
        );
      });

      const rate =
        activePrevMonth > 0
          ? ((activePrevMonth - activeThisMonth) / activePrevMonth) * 100
          : 0;
      const previousRate =
        churnRateMetrics.length > 0
          ? churnRateMetrics[churnRateMetrics.length - 1].rate
          : rate;

      churnRateMetrics.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'long' }),
        rate: Number(rate.toFixed(1)),
        trend: rate <= previousRate ? 'down' : 'up',
      });
    }

    return {
      summary: {
        totalUsers,
        activeUsers,
        newUsers,
        churnRate: Number(churnRate.toFixed(1)),
      },
      userMetrics: {
        dau,
        mau,
        churnRate: churnRateMetrics,
      },
    };
  }

  getViewForecast(query: PaginationQueryDto): {
    generatedAt: string | null;
    horizonDays: number;
    lookbackDays: number;
    metrics: { mae: number | null; mape: number | null };
    total: number;
    data: ViewForecastRecord[];
  } {
    const filePath = resolve(
      process.cwd(),
      'exports/analytics/view-forecast.json',
    );
    if (!existsSync(filePath)) {
      return {
        generatedAt: null,
        horizonDays: 0,
        lookbackDays: 0,
        metrics: { mae: null, mape: null },
        total: 0,
        data: [],
      };
    }

    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as {
      generatedAt?: string;
      horizonDays?: number;
      lookbackDays?: number;
      metrics?: { mae?: number | null; mape?: number | null };
      records?: ViewForecastRecord[];
    };

    const records = parsed.records || [];
    const searched = this.applySearch(records, query);
    const sorted = this.sortForecast(searched, query);
    const paginated = this.paginate(sorted, query);

    return {
      generatedAt: parsed.generatedAt || null,
      horizonDays: parsed.horizonDays || 0,
      lookbackDays: parsed.lookbackDays || 0,
      metrics: {
        mae: parsed.metrics?.mae ?? null,
        mape: parsed.metrics?.mape ?? null,
      },
      total: paginated.total,
      data: paginated.data,
    };
  }

  getChurnPrediction(query: PaginationQueryDto): {
    generatedAt: string | null;
    metrics: {
      accuracy: number | null;
      precision: number | null;
      recall: number | null;
      f1: number | null;
      logLoss: number | null;
    };
    summary: {
      totalUsersScored: number;
      highRiskUsers: number;
      mediumRiskUsers: number;
      lowRiskUsers: number;
    };
    total: number;
    data: ChurnPredictionRecord[];
  } {
    const filePath = resolve(
      process.cwd(),
      'exports/analytics/user-churn-prediction.json',
    );
    if (!existsSync(filePath)) {
      return {
        generatedAt: null,
        metrics: {
          accuracy: null,
          precision: null,
          recall: null,
          f1: null,
          logLoss: null,
        },
        summary: {
          totalUsersScored: 0,
          highRiskUsers: 0,
          mediumRiskUsers: 0,
          lowRiskUsers: 0,
        },
        total: 0,
        data: [],
      };
    }

    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as {
      generatedAt?: string;
      metrics?: {
        accuracy?: number | null;
        precision?: number | null;
        recall?: number | null;
        f1?: number | null;
        logLoss?: number | null;
      };
      summary?: {
        totalUsersScored?: number;
        highRiskUsers?: number;
        mediumRiskUsers?: number;
        lowRiskUsers?: number;
      };
      predictions?: ChurnPredictionRecord[];
    };

    const predictions = parsed.predictions || [];
    const searched = this.applyChurnSearch(predictions, query);
    const sorted = this.sortChurnPrediction(searched, query);
    const paginated = this.paginate(sorted, query);

    return {
      generatedAt: parsed.generatedAt || null,
      metrics: {
        accuracy: parsed.metrics?.accuracy ?? null,
        precision: parsed.metrics?.precision ?? null,
        recall: parsed.metrics?.recall ?? null,
        f1: parsed.metrics?.f1 ?? null,
        logLoss: parsed.metrics?.logLoss ?? null,
      },
      summary: {
        totalUsersScored:
          parsed.summary?.totalUsersScored || predictions.length,
        highRiskUsers: parsed.summary?.highRiskUsers || 0,
        mediumRiskUsers: parsed.summary?.mediumRiskUsers || 0,
        lowRiskUsers: parsed.summary?.lowRiskUsers || 0,
      },
      total: paginated.total,
      data: paginated.data,
    };
  }
}
