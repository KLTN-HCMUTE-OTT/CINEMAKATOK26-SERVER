import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';

import { UserBanSchedulerService } from './user-ban-scheduler.service';
import { AutoUnbanUsersCommand } from '../commands/impl/auto-unban-users.command';

describe('UserBanSchedulerService', () => {
  let service: UserBanSchedulerService;
  let commandBus: jest.Mocked<CommandBus>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserBanSchedulerService,
        { provide: CommandBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    service = module.get(UserBanSchedulerService);
    commandBus = module.get(CommandBus);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('dispatches an AutoUnbanUsersCommand on each run', async () => {
    commandBus.execute.mockResolvedValue(3);

    await service.handleAutoUnban();

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(
      AutoUnbanUsersCommand,
    );
  });

  it('swallows errors so the cron job never crashes the process', async () => {
    commandBus.execute.mockRejectedValue(new Error('db down'));

    await expect(service.handleAutoUnban()).resolves.toBeUndefined();
  });
});
