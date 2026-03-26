import { 
  Controller, Get, Post, Delete, Param, Body, Query, UseGuards 
} from '@nestjs/common';
import { 
  ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiQuery 
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';

import { UserSession } from '@app/common/decorators';
import { JwtAuthGuard, IsAdminGuard } from '@app/common/guards';
import { ApiResponseDto, ResponseBuilder, PaginatedApiResponseDto, PaginationQueryDto } from '@app/common/utils/dto';
import { REPORT_STATUS, REPORT_TYPE } from '@app/common/enums/global.enum';
import { CreateReportDto, ReportDto } from '@app/common/dtos/user-activity/report.dto';
import { BanItemDto } from '@app/common/dtos/user-activity/ban-item.dto';
import { ReportService } from '../services/report.service';
import { plainToInstance } from 'class-transformer';

@Controller('reports')
@ApiTags('User Activity / Reports')
@ApiBearerAuth('access-token')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reports (Admin only)' })
  @ApiOkResponse({
    description: 'List of reports',
    type: PaginatedApiResponseDto(ReportDto),
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order for reports',
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search reports by reporter name, reason, type, or status',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter reports by status (PENDING, APPROVED, REJECTED)',
    example: 'PENDING',
  })

  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async findAll(@Query() query: PaginationQueryDto & { status?: REPORT_STATUS; type?: REPORT_TYPE }) {
    const { data, total } = await firstValueFrom(this.reportService.findAll(query));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map((item: any) => plainToInstance(ReportDto, item, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Reports retrieved successfully',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a report by ID (Admin only)' })
  @ApiOkResponse({ description: 'Report details', type: ApiResponseDto(ReportDto) })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async findOne(@Param('id') id: string) {
    const report = await firstValueFrom(this.reportService.findOne(id));
    return ResponseBuilder.createResponse({
      message: 'Report retrieved successfully',
      data: plainToInstance(ReportDto, report, { excludeExtraneousValues: true }),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new report' })
  @ApiOkResponse({
    description: 'Report created successfully',
    type: ApiResponseDto(ReportDto),
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @UseGuards(JwtAuthGuard)
  async create(
    @UserSession('id') userId: string,
    @Body() createReportDto: CreateReportDto,
  ) {
    const report = await firstValueFrom(this.reportService.create(userId, createReportDto));
    return ResponseBuilder.createResponse({
      message: 'Report submitted successfully',
      data: plainToInstance(ReportDto, report, { excludeExtraneousValues: true }),
    });
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a report and ban the item (Admin only)' })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async approve(@Param('id') id: string) {
    await firstValueFrom(this.reportService.approve(id));
    return ResponseBuilder.createResponse({
      message: 'Report approved and content banned',
      data: null,
    });
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a report (Admin only)' })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async reject(@Param('id') id: string) {
    await firstValueFrom(this.reportService.reject(id));
    return ResponseBuilder.createResponse({
      message: 'Report rejected',
      data: null,
    });
  }

  @Post('ban')
  @ApiOperation({ summary: 'Directly ban an item (Admin only)' })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async ban(@Body() payload: BanItemDto) {
    await firstValueFrom(this.reportService.ban(payload.type, payload.id));
    return ResponseBuilder.createResponse({
      message: 'Item banned successfully',
      data: null,
    });
  }

  @Post('unban')
  @ApiOperation({ summary: 'Unban an item (Admin only)' })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async unban(@Body() payload: BanItemDto) {
    await firstValueFrom(this.reportService.unban(payload.type, payload.id));
    return ResponseBuilder.createResponse({
      message: 'Item unbanned successfully',
      data: null,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a report (Admin only)' })
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  async delete(@Param('id') id: string) {
    await firstValueFrom(this.reportService.delete(id));
    return ResponseBuilder.createResponse({
      message: 'Report deleted successfully',
      data: null,
    });
  }
}
