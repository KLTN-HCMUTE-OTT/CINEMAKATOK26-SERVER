import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { REPORT_STATUS, REPORT_TYPE, REVIEW_STATUS } from '@app/common/enums/global.enum';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { EntityReport } from '../entities/report.entity';
import { EntityReviewEpisode } from '../entities/review-episode.entity';
import { EntityReviewReply } from '../entities/review-reply.entity';
import { EntityReview } from '../entities/review.entity';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { 
  ReportNotFoundError, 
  ReviewNotFoundError, 
  EpisodeReviewNotFoundError, 
  ReviewReplyNotFoundError 
} from '@app/common/exceptions/domain.error';

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
    await this.validateReportTarget(type, targetId);

    const report = this.reportRepository.create({
      type,
      targetId,
      reason,
      details,
      reporterId,
    });

    return this.reportRepository.save(report);
  }

  private async validateReportTarget(type: REPORT_TYPE, targetId: string) {
    if (type === REPORT_TYPE.REVIEW) {
      const review = await this.reviewRepository.findOne({ where: { id: targetId } });
      if (!review) throw new ReviewNotFoundError();
    } else if (type === REPORT_TYPE.EPISODE_REVIEW) {
      const episodeReview = await this.reviewEpisodeRepository.findOne({ where: { id: targetId } });
      if (!episodeReview) throw new EpisodeReviewNotFoundError();
    } else if (type === REPORT_TYPE.REVIEW_REPLY) {
      const reviewReply = await this.reviewReplyRepository.findOne({ where: { id: targetId } });
      if (!reviewReply) throw new ReviewReplyNotFoundError();
    }
  }

  async findAll(query: PaginationQueryDto & { status?: REPORT_STATUS, type?: REPORT_TYPE }) {
    const { page = 1, limit = 10, sort, search, status, type } = query;

    const queryBuilder = this.reportRepository.createQueryBuilder('report');

    if (status) queryBuilder.andWhere('report.status = :status', { status });
    if (type) queryBuilder.andWhere('report.type = :type', { type });
    
    if (search) {
      queryBuilder.andWhere('(report.reason ILIKE :search OR report.details ILIKE :search)', { search: `%${search}%` });
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

    // Enrich reports with target data and reporter information
    const enrichedData = await Promise.all(data.map(report => this.enrichReport(report)));

    return { data: enrichedData, total };
  }

  private async enrichReport(report: EntityReport) {
    const reporter = await this.getExternalInfo(this.userClient, 'user.getById', { id: report.reporterId });

    let review: any = null;
    let episodeReview: any = null;
    if (report.type === REPORT_TYPE.REVIEW) {
      review = await this.reviewRepository.findOne({ where: { id: report.targetId } });
    } else if (report.type === REPORT_TYPE.EPISODE_REVIEW) {
      episodeReview = await this.reviewEpisodeRepository.findOne({ where: { id: report.targetId } });
    }

    return {
      ...report,
      reporter,
      review,
      episodeReview,
    };
  }

  async findOne(id: string): Promise<EntityReport> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new ReportNotFoundError();
    return report;
  }

  async approveItem(id: string): Promise<boolean> {
    const report = await this.findOne(id);
    
    // Ban the reported item
    await this.banItem(report.type, report.targetId);

    // Update report status to APPROVED
    await this.reportRepository.update(id, { status: REPORT_STATUS.APPROVED });
    return true;
  }

  async rejectItem(id: string): Promise<boolean> {
    const report = await this.findOne(id);
    await this.reportRepository.update(id, { status: REPORT_STATUS.REJECTED });
    return true;
  }

  async banItem(type: REPORT_TYPE, id: string): Promise<boolean> {
    let targetUser: any = null;
    let contentInfo: any = null;

    if (type === REPORT_TYPE.REVIEW) {
      const review = await this.reviewRepository.findOne({ where: { id } });
      if (!review) throw new ReviewNotFoundError();
      
      await this.reviewRepository.update(id, { status: REVIEW_STATUS.BANNED });
      targetUser = await this.getExternalInfo(this.userClient, 'user.getById', { id: review.userId });
      contentInfo = await this.getExternalInfo(this.contentClient, 'content.getContentById', { id: review.contentId });
      
      await this.sendBanEmail(targetUser, contentInfo?.title || 'Unknown Content', review.contentReviewed, 'Review');

    } else if (type === REPORT_TYPE.EPISODE_REVIEW) {
      const epReview = await this.reviewEpisodeRepository.findOne({ where: { id } });
      if (!epReview) throw new EpisodeReviewNotFoundError();
      
      await this.reviewEpisodeRepository.update(id, { status: REVIEW_STATUS.BANNED });
      targetUser = await this.getExternalInfo(this.userClient, 'user.getById', { id: epReview.userId });
      // Fetch details from content service if needed, for now use generic info
      await this.sendBanEmail(targetUser, 'Specific Episode', epReview.contentReviewed, 'Episode Review');

    } else if (type === REPORT_TYPE.REVIEW_REPLY) {
      const reply = await this.reviewReplyRepository.findOne({ where: { id } });
      if (!reply) throw new ReviewReplyNotFoundError();
      
      await this.reviewReplyRepository.update(id, { status: REVIEW_STATUS.BANNED });
      targetUser = await this.getExternalInfo(this.userClient, 'user.getById', { id: reply.userId });
      await this.sendBanEmail(targetUser, 'Review Reply', reply.content, 'Review Reply');
    }

    // Also update all pending reports for this target to APPROVED
    await this.reportRepository.update(
      { targetId: id, type: type, status: REPORT_STATUS.PENDING },
      { status: REPORT_STATUS.APPROVED }
    );
        return true;
  }

  async unbanItem(type: REPORT_TYPE, id: string): Promise<boolean> {
    let targetUser: any = null;

    if (type === REPORT_TYPE.REVIEW) {
      const review = await this.reviewRepository.findOne({ where: { id } });
      if (!review) throw new ReviewNotFoundError();
      await this.reviewRepository.update(id, { status: REVIEW_STATUS.ACTIVE });
      targetUser = await this.getExternalInfo(this.userClient, 'user.getById', { id: review.userId });
      await this.sendRestoreEmail(targetUser, 'Your Review');
    } else if (type === REPORT_TYPE.EPISODE_REVIEW) {
      const epReview = await this.reviewEpisodeRepository.findOne({ where: { id } });
      if (!epReview) throw new EpisodeReviewNotFoundError();
      await this.reviewEpisodeRepository.update(id, { status: REVIEW_STATUS.ACTIVE });
      targetUser = await this.getExternalInfo(this.userClient, 'user.getById', { id: epReview.userId });
      await this.sendRestoreEmail(targetUser, 'Your Episode Review');
    } else if (type === REPORT_TYPE.REVIEW_REPLY) {
      const reply = await this.reviewReplyRepository.findOne({ where: { id } });
      if (!reply) throw new ReviewReplyNotFoundError();
      await this.reviewReplyRepository.update(id, { status: REVIEW_STATUS.ACTIVE });
      targetUser = await this.getExternalInfo(this.userClient, 'user.getById', { id: reply.userId });
      await this.sendRestoreEmail(targetUser, 'Your Review Reply');
    }
    
    return true;
  }

  private async getExternalInfo(client: ClientProxy, cmd: string, payload: any): Promise<any> {
    try {
      return await firstValueFrom(client.send({ cmd }, payload));
    } catch (error) {
      this.logger.error(`External call failed [${cmd}]: ${error.message}`);
      return null;
    }
  }

  private async sendBanEmail(user: any, contentTitle: string, bannedContent: string, itemType: string) {
    if (!user || !user.email) return;
    this.notificationClient.emit('notification.sendReviewBan', {
      email: user.email,
      userName: user.name || 'User',
      contentTitle,
      bannedContent,
      itemType,
    });
  }

  private async sendRestoreEmail(user: any, itemDescription: string) {
    if (!user || !user.email) return;

    this.notificationClient.emit('notification.sendReviewRestore', {
      email: user.email,
      userName: user.name || 'User',
      itemDescription,
    });
  }

  async delete(id: string): Promise<boolean> {
    const report = await this.findOne(id);
    await this.reportRepository.remove(report);
    return true;
  }
}
