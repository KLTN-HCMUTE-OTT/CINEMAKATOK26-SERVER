import type { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { AuditLog } from '../entities/audit-log.entity';
import { CreateAuditLogDto } from '@app/common/dtos/audit-log/audit-log.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog, 'audit')
    private auditLogRepository: Repository<AuditLog>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
  ) {}

  private getSignalWeight(action: LOG_ACTION): number {
    switch (action) {
      case LOG_ACTION.PLAY_MOVIE:
      case LOG_ACTION.PLAY_EPISODE_OF_SERIES:
      case LOG_ACTION.LIKE_MOVIE:
      case LOG_ACTION.LIKE_SERIES:
        return 2;
      case LOG_ACTION.ADD_MOVIE_TO_WATCHLIST:
      case LOG_ACTION.ADD_SERIES_TO_WATCHLIST:
      case LOG_ACTION.CREATE_REVIEW:
        return 1;
      case LOG_ACTION.UNLIKE_MOVIE:
      case LOG_ACTION.UNLIKE_SERIES:
      case LOG_ACTION.REMOVE_MOVIE_FROM_WATCHLIST:
      case LOG_ACTION.REMOVE_SERIES_FROM_WATCHLIST:
        return -1;
      default:
        return 0;
    }
  }

  async log(dto: Partial<CreateAuditLogDto>): Promise<AuditLog> {
    const { userId, action } = dto;

    const sessionKey = `session:${userId}`;
    let sessionId = await this.cacheManager.get<string>(sessionKey);

    if (!sessionId) {
      sessionId = uuidv4();
    }

    await this.cacheManager.set(sessionKey, sessionId, 1800000);

    const signalWeight = this.getSignalWeight(action as LOG_ACTION);

    const newLog = this.auditLogRepository.create({
      ...dto,
      sessionId,
      signalWeight,
    });

    return await this.auditLogRepository.save(newLog);
  }

  async findAll(query: PaginationQueryDto) {
    const { page = 1, limit = 20 } = query;
    const result = await this.auditLogRepository.find({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    const total = await this.auditLogRepository.count();
    return { result, total };
  }

  async getRecentActivity(query: PaginationQueryDto) {
    const { page = 1, limit = 20 } = query;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await this.auditLogRepository
      .createQueryBuilder('log')
      .select([
        'log.id',
        'log.userId',
        'log.action',
        'log.createdAt',
        'log.metadata',
      ])
      .where('log.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('log.createdAt <= :now', { now: new Date() })
      .andWhere('log.action != :excludedAction', {
        excludedAction: LOG_ACTION.CONTENT_VIEW_INCREASED,
      })
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany<{
        log_id: string;
        log_userId: string;
        log_action: LOG_ACTION;
        log_createdAt: Date;
        log_metadata: Record<string, any> | null;
      }>();

    const total = await this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('log.createdAt <= :now', { now: new Date() })
      .andWhere('log.action != :excludedAction', {
        excludedAction: LOG_ACTION.CONTENT_VIEW_INCREASED,
      })
      .getCount();

    const resultWithUserNames = logs
      .map((log) => ({
        id: log.log_id,
        userId: log.log_userId,
        action: log.log_action,
        createdAt: log.log_createdAt,
        metadata: log.log_metadata,
        userName: 'Unknown User',
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return { result: resultWithUserNames, total };
  }

  async getTransactionsForFPGrowth(): Promise<AuditLog[]> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return await this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.signalWeight > 0')
      .andWhere('log.resourceId IS NOT NULL')
      .andWhere('log.createdAt >= :ninetyDaysAgo', { ninetyDaysAgo })
      .orderBy('log.sessionId', 'ASC')
      .addOrderBy('log.createdAt', 'ASC')
      .getMany();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async deleteOldLogs() {
    console.log('Running nightly audit log cleanup...');
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :ninetyDaysAgo', { ninetyDaysAgo })
      .execute();

    console.log(`Deleted ${result.affected} old audit logs.`);
  }

  async logVideoAction(
    userId: string,
    videoId: string,
  ): Promise<AuditLog | undefined> {
    const videoResult = await firstValueFrom(
      this.contentClient.send<{
        movieId?: string;
        tvSeriesId?: string;
        episodeId?: string;
      }>({ cmd: 'content.getMovieOrSeriesFromVideo' }, { videoId }),
    );

    if (!videoResult) {
      throw new NotFoundException({
        message: `Video with ID ${videoId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    if (videoResult.movieId) {
      return await this.log({
        action: LOG_ACTION.PLAY_MOVIE,
        userId,
        resourceType: RESOURCE_TYPE.MOVIE,
        resourceId: videoResult.movieId,
        metadata: { videoId },
      });
    } else if (videoResult.tvSeriesId) {
      return await this.log({
        action: LOG_ACTION.PLAY_EPISODE_OF_SERIES,
        userId,
        resourceType: RESOURCE_TYPE.SERIES,
        resourceId: videoResult.tvSeriesId,
        metadata: { videoId, episodeId: videoResult.episodeId },
      });
    }
  }
}
