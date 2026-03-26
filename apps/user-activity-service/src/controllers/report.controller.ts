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
    create(@Payload() payload: { reporterId: string } & any) {
        const { reporterId, ...createDto } = payload;
        return this.reportService.create(reporterId, createDto);
    }

    @MessagePattern({ cmd: 'activity.report.approve' })
    approve(@Payload() payload: { id: string }) {
        return this.reportService.approveItem(payload.id);
    }

    @MessagePattern({ cmd: 'activity.report.reject' })
    reject(@Payload() payload: { id: string }) {
        return this.reportService.rejectItem(payload.id);
    }

    @MessagePattern({ cmd: 'activity.report.ban' })
    ban(@Payload() payload: { type: REPORT_TYPE, id: string }) {
        return this.reportService.banItem(payload.type, payload.id);
    }

    @MessagePattern({ cmd: 'activity.report.unban' })
    unban(@Payload() payload: { type: REPORT_TYPE, id: string }) {
        return this.reportService.unbanItem(payload.type, payload.id);
    }

    @MessagePattern({ cmd: 'activity.report.delete' })
    delete(@Payload() payload: { id: string }) {
        return this.reportService.delete(payload.id);
    }
}
