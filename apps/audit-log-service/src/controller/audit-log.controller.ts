import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateAuditLogDto } from '@app/common/dtos/audit-log/audit-log.dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { AuditLogService } from '../service/audit-log.service';

@Controller()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @MessagePattern({ cmd: 'create_audit_log' })
  async createAuditLog(@Payload() data: Partial<CreateAuditLogDto>) {
    return await this.auditLogService.log(data);
  }

  @MessagePattern({ cmd: 'get_audit_logs' })
  async getLogs(@Payload() query: PaginationQueryDto) {
    return await this.auditLogService.findAll(query);
  }

  @MessagePattern({ cmd: 'create_video_log' })
  async createLog(@Payload() data: { userId: string; videoId: string }) {
    return await this.auditLogService.logVideoAction(data.userId, data.videoId);
  }

  @MessagePattern({ cmd: 'get_recent_activity' })
  async getRecentActivity(@Payload() query: PaginationQueryDto) {
    return await this.auditLogService.getRecentActivity(query);
  }

  @MessagePattern({ cmd: 'get_transactions' })
  async getTransactionsForFPGrowth() {
    return await this.auditLogService.getTransactionsForFPGrowth();
  }
}
