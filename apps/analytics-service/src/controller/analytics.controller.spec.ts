import { Test, TestingModule } from '@nestjs/testing';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from '../service/analytics.service';
import { ForecastTrainingScheduler } from '../scheduler/forecast-training.scheduler';
import { ChurnTrainingScheduler } from '../scheduler/churn-training.scheduler';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: jest.Mocked<AnalyticsService>;
  let forecastScheduler: jest.Mocked<ForecastTrainingScheduler>;
  let churnScheduler: jest.Mocked<ChurnTrainingScheduler>;

  beforeEach(async () => {
    const analyticsServiceMock: Partial<jest.Mocked<AnalyticsService>> = {
      getMoviesStats: jest.fn(),
      getTVSeriesStats: jest.fn(),
      getCategoriesStats: jest.fn(),
      getUserStats: jest.fn(),
      getTrendingMovies: jest.fn(),
      getTrendingTVSeries: jest.fn(),
      getViewForecast: jest.fn(),
      getChurnPrediction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        {
          provide: ForecastTrainingScheduler,
          useValue: { manualRetrain: jest.fn() },
        },
        {
          provide: ChurnTrainingScheduler,
          useValue: { manualRetrain: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AnalyticsController);
    analyticsService = module.get(AnalyticsService);
    forecastScheduler = module.get(ForecastTrainingScheduler);
    churnScheduler = module.get(ChurnTrainingScheduler);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getMoviesStats to the service with the given query', () => {
    const query = { page: 2, limit: 5 };
    const expected = { data: [], total: 0 };
    analyticsService.getMoviesStats.mockReturnValue(expected as never);

    expect(controller.getMoviesStats(query)).toBe(expected);
    expect(analyticsService.getMoviesStats).toHaveBeenCalledWith(query);
  });

  it('defaults to an empty query object when payload is missing', () => {
    analyticsService.getTVSeriesStats.mockReturnValue({} as never);

    controller.getTVSeriesStats(undefined as never);

    expect(analyticsService.getTVSeriesStats).toHaveBeenCalledWith({});
  });

  it('delegates getCategoriesStats to the service', () => {
    controller.getCategoriesStats({ page: 1 });
    expect(analyticsService.getCategoriesStats).toHaveBeenCalledWith({
      page: 1,
    });
  });

  it('delegates getUserStats to the service', () => {
    controller.getUserStats();
    expect(analyticsService.getUserStats).toHaveBeenCalledTimes(1);
  });

  it('delegates getTrendingMovies and getTrendingTVSeries', () => {
    controller.getTrendingMovies({ limit: 3 });
    controller.getTrendingTVSeries({ limit: 4 });
    expect(analyticsService.getTrendingMovies).toHaveBeenCalledWith({ limit: 3 });
    expect(analyticsService.getTrendingTVSeries).toHaveBeenCalledWith({
      limit: 4,
    });
  });

  it('delegates getViewForecast and getChurnPrediction', () => {
    controller.getViewForecast({});
    controller.getChurnPrediction({});
    expect(analyticsService.getViewForecast).toHaveBeenCalledWith({});
    expect(analyticsService.getChurnPrediction).toHaveBeenCalledWith({});
  });

  it('routes retrainForecast to the forecast scheduler', async () => {
    forecastScheduler.manualRetrain.mockResolvedValue({ ok: true } as never);

    await expect(controller.retrainForecast()).resolves.toEqual({ ok: true });
    expect(forecastScheduler.manualRetrain).toHaveBeenCalledTimes(1);
  });

  it('routes retrainChurnPrediction to the churn scheduler', async () => {
    churnScheduler.manualRetrain.mockResolvedValue({ ok: true } as never);

    await expect(controller.retrainChurnPrediction()).resolves.toEqual({
      ok: true,
    });
    expect(churnScheduler.manualRetrain).toHaveBeenCalledTimes(1);
  });
});
