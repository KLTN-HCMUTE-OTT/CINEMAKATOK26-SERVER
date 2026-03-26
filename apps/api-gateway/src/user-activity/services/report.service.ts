import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

import { REPORT_STATUS, REPORT_TYPE } from '@app/common/enums/global.enum';
import { catchRpcError } from '@app/common/exceptions';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { CreateReportDto } from '@app/common/dtos/user-activity/report.dto';

@Injectable()
export class ReportService {
  constructor(
    @Inject('USER_ACTIVITY_SERVICE')
    private readonly userActivityClient: ClientProxy,
  ) {}

  findAll(query: PaginationQueryDto & { status?: REPORT_STATUS; type?: REPORT_TYPE }): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.list' }, query)
      .pipe(catchRpcError());
  }

  findOne(id: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.get' }, { id })
      .pipe(catchRpcError());
  }

  create(reporterId: string, createDto: CreateReportDto): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.create' }, { reporterId, ...createDto })
      .pipe(catchRpcError());
  }

  approve(id: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.approve' }, { id })
      .pipe(catchRpcError());
  }

  reject(id: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.reject' }, { id })
      .pipe(catchRpcError());
  }

  ban(type: REPORT_TYPE, id: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.ban' }, { type, id })
      .pipe(catchRpcError());
  }

  unban(type: REPORT_TYPE, id: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.unban' }, { type, id })
      .pipe(catchRpcError());
  }

  delete(id: string): Observable<any> {
    return this.userActivityClient
      .send({ cmd: 'activity.report.delete' }, { id })
      .pipe(catchRpcError());
  }
}
