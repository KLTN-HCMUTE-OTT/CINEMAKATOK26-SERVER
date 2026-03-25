import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { REPORT_STATUS, REPORT_TYPE, REVIEW_STATUS } from '@app/common/enums/global.enum';
import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { EntityReport } from '../entities/report.entity';
import { EntityReviewEpisode } from '../entities/review-episode.entity';
import { EntityReviewReply } from '../entities/review-reply.entity';
import { EntityReview } from '../entities/review.entity';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { ERROR_CODE } from '@app/common/constants/global.constants';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(EntityReport, 'activity')
    private readonly reportRepository: Repository<EntityReport>,
    @InjectRepository(EntityReview, 'activity')
    private readonly reviewRepository: Repository<EntityReview>,
    @InjectRepository(EntityReviewEpisode, 'activity')
    private readonly reviewEpisodeRepository: Repository<EntityReviewEpisode>,
    @InjectRepository(EntityReviewReply, 'activity')
    private readonly reviewReplyRepository: Repository<EntityReviewReply>,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    @Inject('USER_SERVICE')
    private readonly userClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async create(reporterId: string, payload: any): Promise<EntityReport> {
    const { type, targetId, reason, details } = payload;

    // Check if the target exists within this microservice
    if (type === REPORT_TYPE.REVIEW) {
      const review = await this.reviewRepository.findOne({ where: { id: targetId } });
      if (!review) throw new NotFoundException('Review not found');
    } else if (type === REPORT_TYPE.EPISODE_REVIEW) {
      const episodeReview = await this.reviewEpisodeRepository.findOne({ where: { id: targetId } });
      if (!episodeReview) throw new NotFoundException({message: 'Episode review not found', code: ERROR_CODE.ENTITY_NOT_FOUND});
    } else if (type === REPORT_TYPE.REVIEW_REPLY) {
      const reviewReply = await this.reviewReplyRepository.findOne({ where: { id: targetId } });
      if (!reviewReply) throw new NotFoundException({message: 'Review reply not found', code: ERROR_CODE.ENTITY_NOT_FOUND});
    }

    const report = this.reportRepository.create({
      type,
      targetId,
      reason,
      details,
      reporterId,
    });

    return this.reportRepository.save(report);
  }

  async findAll(query: PaginationQueryDto & { status?: REPORT_STATUS, type?: REPORT_TYPE }) {
    const { page = 1, limit = 10, sort, search, status, type } = query;

    const queryBuilder = this.reportRepository.createQueryBuilder('report');

    if (status) queryBuilder.andWhere('report.status = :status', { status });
    if (type) queryBuilder.andWhere('report.type = :type', { type });
    
    if (search) {
      queryBuilder.andWhere('report.reason ILIKE :search OR report.details ILIKE :search', { search: `%${search}%` });
    }

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.entries(sortObj).forEach(([key, order]) => {
        queryBuilder.addOrderBy(`report.${key}`, order as 'ASC' | 'DESC');
      });
    } else {
      queryBuilder.orderBy('report.createdAt', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<EntityReport> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async updateStatus(id: string, status: REPORT_STATUS): Promise<EntityReport> {
    const report = await this.findOne(id);
    report.status = status;
    const savedReport = await this.reportRepository.save(report);

    // If approved, we might want to automatically ban the item
    if (status === REPORT_STATUS.APPROVED) {
        await this.handleItemBan(report.type, report.targetId);
    }

    // Notify the reporter
    this.notifyReporter(savedReport).catch(err => 
      this.logger.error(`Failed to notify reporter for report ${id}: ${err.message}`)
    );

    return savedReport;
  }

  private async notifyReporter(report: EntityReport) {
    const reporter = await this.getReporterInfo(report.reporterId);
    if (!reporter || !reporter.email) return;

    const result = report.status === REPORT_STATUS.APPROVED 
        ? 'Your report has been approved and the content has been removed or restricted.'
        : 'Your report has been processed but no violation was found at this time.';

    this.notificationClient.emit('notification.sendReportResult', {
        email: reporter.email,
        userName: reporter.userName || reporter.firstName || 'User',
        reportId: report.id,
        result: result
    });
  }

  private async getReporterInfo(userId: string): Promise<any> {
    try {
        return await firstValueFrom(this.userClient.send({ cmd: 'user.getById' }, { id: userId }));
    } catch (error) {
        this.logger.error(`Failed to get reporter info for user ${userId}: ${error.message}`);
        return null;
    }
  }

  private async handleItemBan(type: REPORT_TYPE, targetId: string) {
    if (type === REPORT_TYPE.REVIEW) {
        await this.reviewRepository.update(targetId, { status: REVIEW_STATUS.BANNED });
    } else if (type === REPORT_TYPE.EPISODE_REVIEW) {
        await this.reviewEpisodeRepository.update(targetId, { status: REVIEW_STATUS.BANNED });
    } else if (type === REPORT_TYPE.REVIEW_REPLY) {
        await this.reviewReplyRepository.update(targetId, { status: REVIEW_STATUS.BANNED });
    }
    
    this.contentClient.emit('activity.item.banned', { type, targetId });
  }

  async delete(id: string): Promise<void> {
    const report = await this.findOne(id);
    await this.reportRepository.remove(report);
  }
}
