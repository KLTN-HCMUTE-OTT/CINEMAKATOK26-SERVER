import * as fs from 'fs';

import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';

import { AnalyticsService } from './analytics.service';

jest.mock('fs');

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let contentClient: { send: jest.Mock };
  let auditClient: { send: jest.Mock };

  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(async () => {
    contentClient = { send: jest.fn() };
    auditClient = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: 'CONTENT_SERVICE', useValue: contentClient as unknown as ClientProxy },
        { provide: 'AUDIT_LOG_SERVICE', useValue: auditClient as unknown as ClientProxy },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMoviesStats', () => {
    it('aggregates movie stats from the content and audit clients', async () => {
      contentClient.send.mockReturnValue(
        of({
          data: [
            {
              id: 'm1',
              metaData: { id: 'm1', title: 'Movie One', viewCount: 100 },
            },
          ],
          total: 1,
        }),
      );
      auditClient.send.mockReturnValue(of({ result: [], total: 0 }));

      const result = await service.getMoviesStats({ page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({
        id: 'm1',
        title: 'Movie One',
        views: 100,
        percentage: 100,
      });
      expect(contentClient.send).toHaveBeenCalledWith(
        { cmd: 'content.getMovies' },
        expect.objectContaining({ page: 1 }),
      );
    });

    it('falls back to safe defaults for malformed movie records', async () => {
      contentClient.send.mockReturnValue(of({ data: [{}], total: 1 }));
      auditClient.send.mockReturnValue(of({ result: [], total: 0 }));

      const result = await service.getMoviesStats({});

      expect(result.data[0]).toMatchObject({ title: 'Unknown', views: 0 });
    });
  });

  describe('getViewForecast', () => {
    it('returns an empty forecast when the export file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = service.getViewForecast({});

      expect(result).toMatchObject({
        generatedAt: null,
        total: 0,
        data: [],
        metrics: { mae: null, mape: null },
      });
      expect(mockedFs.readFileSync).not.toHaveBeenCalled();
    });

    it('parses, sorts and paginates forecast records from disk', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(
        JSON.stringify({
          generatedAt: '2026-01-01',
          horizonDays: 7,
          lookbackDays: 30,
          metrics: { mae: 1.2, mape: 3.4 },
          records: [
            { contentId: 'a', title: 'A', totalForecast7d: 10 },
            { contentId: 'b', title: 'B', totalForecast7d: 99 },
          ],
        }) as never,
      );

      const result = service.getViewForecast({ page: 1, limit: 10 });

      expect(result.total).toBe(2);
      // default sort is by totalForecast7d DESC
      expect(result.data[0].contentId).toBe('b');
      expect(result.metrics).toEqual({ mae: 1.2, mape: 3.4 });
    });
  });

  describe('getChurnPrediction', () => {
    it('returns empty churn summary when the export file is missing', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = service.getChurnPrediction({});

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
      expect(result.summary.totalUsersScored).toBe(0);
    });
  });
});
