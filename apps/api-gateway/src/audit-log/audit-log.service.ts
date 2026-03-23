import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchRpcError } from '@app/common/exceptions';
import { Observable } from 'rxjs';

@Injectable()
export class AuditLogService {
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
}

