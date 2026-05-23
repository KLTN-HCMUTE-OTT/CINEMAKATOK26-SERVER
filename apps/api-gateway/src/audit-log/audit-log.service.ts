import { LOG_ACTION } from '@app/common/enums/log.enum';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchRpcError } from '@app/common/exceptions';
import { firstValueFrom, Observable } from 'rxjs';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @Inject('AUDIT_LOG_SERVICE') private readonly auditClient: ClientProxy,
  ) {}

  findAll(query: PaginationQueryDto): Observable<any> {
    return this.auditClient.send({ cmd: 'get_audit_logs' }, query || {}).pipe(catchRpcError());
  }

  logVideoAction(userId: string, videoId: string): Observable<any> {
    return this.auditClient.send({ cmd: 'create_video_log' }, { userId, videoId }).pipe(catchRpcError());
  }

  getRecentActivity(query: PaginationQueryDto): Observable<any> {
    return this.auditClient.send({ cmd: 'get_recent_activity' }, query || {}).pipe(catchRpcError());
  }

  getTransactionsForFPGrowth(): Observable<any> {
    return this.auditClient.send({ cmd: 'get_transactions' }, {}).pipe(catchRpcError());
  }

  logWatchPartyAction(data: {
    userId: string;
    action: LOG_ACTION;
    roomId: string;
    metadata?: Record<string, unknown>;
  }): void {
    firstValueFrom(
      this.auditClient.send({ cmd: 'create_watch_party_log' }, data),
    ).catch((err) =>
      this.logger.warn(`Failed to write watch-party audit log: ${(err as Error)?.message}`),
    );
  }
}

