import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';

import { AutoUnbanUsersCommand } from '../commands/impl/auto-unban-users.command';

@Injectable()
export class UserBanSchedulerService {
  private readonly logger = new Logger(UserBanSchedulerService.name);

  constructor(private readonly commandBus: CommandBus) {}

  /**
   * Check and auto-unban users every hour (every hour at minute 0)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoUnban() {
    try {
      this.logger.debug('Starting auto-unban check...');
      const unbannedCount = await this.commandBus.execute(new AutoUnbanUsersCommand());
      if (unbannedCount > 0) {
        this.logger.log(`Successfully auto-unbanned ${unbannedCount} users`);
      }
    } catch (error) {
      this.logger.error('Error during auto-unban check:', error);
    }
  }
}
