import { Test, TestingModule } from '@nestjs/testing';

import { LOG_ACTION } from '@app/common/enums/log.enum';

import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from '../service/audit-log.service';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AuditLogService>> = {
      log: jest.fn(),
      findAll: jest.fn(),
      logVideoAction: jest.fn(),
      getRecentActivity: jest.fn(),
      getTransactionsForFPGrowth: jest.fn(),
      logWatchPartyAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [{ provide: AuditLogService, useValue: serviceMock }],
    }).compile();

    controller = module.get(AuditLogController);
    service = module.get(AuditLogService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createAuditLog forwards the payload to service.log', async () => {
    const dto = { userId: 'u1', action: LOG_ACTION.PLAY_MOVIE };
    service.log.mockResolvedValue({ id: 'log1' } as never);

    await expect(controller.createAuditLog(dto)).resolves.toEqual({
      id: 'log1',
    });
    expect(service.log).toHaveBeenCalledWith(dto);
  });

  it('getLogs forwards the pagination query to service.findAll', async () => {
    const query = { page: 2, limit: 50 };
    service.findAll.mockResolvedValue({ result: [], total: 0 } as never);

    await controller.getLogs(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('createLog maps the payload into logVideoAction args', async () => {
    await controller.createLog({ userId: 'u1', videoId: 'v1' });
    expect(service.logVideoAction).toHaveBeenCalledWith('u1', 'v1');
  });

  it('createWatchPartyLog forwards the whole payload object', async () => {
    const data = {
      userId: 'u1',
      action: LOG_ACTION.PLAY_MOVIE,
      roomId: 'r1',
      metadata: { foo: 'bar' },
    };
    await controller.createWatchPartyLog(data);
    expect(service.logWatchPartyAction).toHaveBeenCalledWith(data);
  });

  it('getTransactionsForFPGrowth delegates with no args', async () => {
    await controller.getTransactionsForFPGrowth();
    expect(service.getTransactionsForFPGrowth).toHaveBeenCalledTimes(1);
  });
});
