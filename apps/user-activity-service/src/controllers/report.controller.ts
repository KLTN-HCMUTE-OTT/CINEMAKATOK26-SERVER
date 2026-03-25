import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ReportService } from "../services/report.service";
import { PaginationQueryDto } from "@app/common/utils/dto/pagination-query.dto";
import { REPORT_STATUS, REPORT_TYPE } from "@app/common/enums/global.enum";
// Assuming there are DTOs for reports, I'll use any for now if I don't see them
// I'll check services/report.service.ts later

@Controller('report')
export class ReportController {
    constructor(
        private readonly reportService: ReportService,
    ) {}

    @MessagePattern({ cmd: 'activity.report.list' })
    findAll(@Payload() query: PaginationQueryDto & { status?: REPORT_STATUS, type?: REPORT_TYPE }) {
        return this.reportService.findAll(query);
    }

    @MessagePattern({ cmd: 'activity.report.get' })
    findOne(@Payload() payload: { id: string }) {
        return this.reportService.findOne(payload.id);
    }

    @MessagePattern({ cmd: 'activity.report.create' })
    create(@Payload() payload: any & { userId: string }) {
        const { userId, ...createDto } = payload;
        return this.reportService.create(userId, createDto);
    }

    @MessagePattern({ cmd: 'activity.report.update-status' })
    updateStatus(@Payload() payload: { id: string, status: any }) {
        return this.reportService.updateStatus(payload.id, payload.status);
    }
}
