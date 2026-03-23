import { plainToInstance } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { UserSession } from '@app/common/decorators';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';
import { ApiResponseDto, PaginatedApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuditLogDto, AuditLogVideo, RecentActivityDto } from '@app/common/dtos/audit-log/audit-log.dto';
import { LOG_ACTION } from '@app/common/enums/log.enum';
import { resolveDescription } from '@app/common/constants/log';

import { AuditLogService } from './audit-log.service';
import { UserService } from '../user/user.service';


@Controller('audit-logs')
@ApiTags('gsa / Audit Logs')
@ApiBearerAuth()
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly userService: UserService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiProperty({ description: 'Get audit logs with an optional limit' })
  @ApiResponse({
    status: 200,
    description: 'List of audit logs',
    type: PaginatedApiResponseDto(AuditLogDto),
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort order for audit logs', example: '{ "createdAt": "DESC" }' })
  @ApiQuery({ name: 'search', required: false, description: 'Search audit logs by user ID or action' })
  async getLogs(@Query() query: PaginationQueryDto) {
    const results = await firstValueFrom(this.auditLogService.findAll(query));
    return ResponseBuilder.createPaginatedResponse({
      data: results.result.map((log: any) =>
        plainToInstance(AuditLogDto, log, { excludeExtraneousValues: true }),
      ),
      totalItems: results.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 20,
      message: 'Audit logs retrieved successfully',
    });
  }

  @Post('/video-action')
  @UseGuards(JwtAuthGuard)
  @ApiProperty({ description: 'Create a new audit log entry' })
  @ApiResponse({
    status: 201,
    description: 'The audit log has been created.',
    type: ApiResponseDto(AuditLogDto),
  })
  async createLog(@UserSession('id') userId: string, @Body() auditLogVideo: AuditLogVideo) {
    const log = await firstValueFrom(this.auditLogService.logVideoAction(userId, auditLogVideo.videoId));
    return ResponseBuilder.createResponse({
      data: plainToInstance(AuditLogDto, log, { excludeExtraneousValues: true }),
      message: 'Audit log created successfully',
    });
  }

  @Get('/recent-activity')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiProperty({ description: 'Get recent activity logs from the last 7 days with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of recent activity logs',
    type: PaginatedApiResponseDto(RecentActivityDto),
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  async getRecentActivity(@Query() query: PaginationQueryDto) {
    const results = await firstValueFrom(this.auditLogService.getRecentActivity(query));

    // Batch-fetch user names for all unique user IDs in one RPC call
    const uniqueUserIds = [...new Set<string>(results.result.map((log: any) => log.userId))];
    let userNameMap = new Map<string, string>();

    if (uniqueUserIds.length > 0) {
      const users: any[] = await firstValueFrom(this.userService.getUsersByIds(uniqueUserIds));
      userNameMap = new Map(users.map((u) => [u.id, u.name ?? u.fullName ?? 'Unknown User']));
    }

    return ResponseBuilder.createPaginatedResponse({
      data: results.result.map((log: any) =>
        plainToInstance(
          RecentActivityDto,
          {
            ...log,
            userName: userNameMap.get(log.userId) ?? 'Unknown User',
            description: resolveDescription(log.action, log.metadata),
          },
          { excludeExtraneousValues: true },
        ),
      ),
      totalItems: results.total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 20,
      message: 'Recent activity logs retrieved successfully',
    });
  }

  @Get('/transactions')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @ApiProperty({ description: 'Get user transactions grouped by session for FP-Growth batch job' })
  @ApiResponse({
    status: 200,
    description: 'List of audit log transactions with strong/medium signals',
    type: [AuditLogDto],
  })
  async getTransactionsForFPGrowth() {
    const logs = await firstValueFrom(this.auditLogService.getTransactionsForFPGrowth());
    return ResponseBuilder.createResponse({
      data: logs.map((log: any) => plainToInstance(AuditLogDto, log, { excludeExtraneousValues: true })),
      message: 'FP-Growth transactions retrieved successfully',
    });
  }
}
