import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { EmailService } from '../services/email.service';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly emailService: EmailService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  @EventPattern('notification.sendOtp')
  async sendOtp(
    @Payload() data: { email: string; otp: string; purpose: string },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendOtpEmail(data.email, data.otp, data.purpose);
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendOtp failed', error?.message);
      channel.nack(msg, false, false); // discard — already logged inside EmailService
    }
  }

  @EventPattern('notification.sendPasswordResetConfirmation')
  async sendPasswordResetConfirmation(
    @Payload() data: { email: string },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendPasswordResetConfirmation(data.email);
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendPasswordResetConfirmation failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('notification.sendBanNotification')
  async sendBanNotification(
    @Payload()
    data: {
      email: string;
      userName: string;
      banReason: string;
      bannedUntil: Date;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendBanNotification(
        data.email,
        data.userName,
        data.banReason,
        data.bannedUntil,
      );
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendBanNotification failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('notification.sendUnbanNotification')
  async sendUnbanNotification(
    @Payload()
    data: {
      email: string;
      userName: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendUserUnbanNotification(
        data.email,
        data.userName,
      );
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendUnbanNotification failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('notification.sendEmail')
  async sendEmail(
    @Payload() data: { to: string; subject: string; html: string },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendEmail(data.to, data.subject, data.html);
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendEmail failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('notification.sendReportResult')
  async sendReportResult(
    @Payload()
    data: {
      email: string;
      userName: string;
      reportId: string;
      result: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendReportResult(
        data.email,
        data.userName,
        data.reportId,
        data.result,
      );
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendReportResult failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('notification.sendReviewBan')
  async sendReviewBan(
    @Payload()
    data: {
      email: string;
      userName: string;
      contentTitle: string;
      bannedContent: string;
      itemType: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendReviewBanNotification(
        data.email,
        data.userName,
        data.contentTitle,
        data.bannedContent,
        data.itemType,
      );
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendReviewBan failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('notification.sendReviewRestore')
  async sendReviewRestore(
    @Payload()
    data: {
      email: string;
      userName: string;
      itemDescription: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      await this.emailService.sendReviewRestoreNotification(
        data.email,
        data.userName,
        data.itemDescription,
      );
      channel.ack(msg);
    } catch (error) {
      this.logger.error('sendReviewRestore failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('subscription.expired')
  async handleSubscriptionExpired(
    @Payload() data: { userId: string; plan: string },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      const user = await firstValueFrom(
        this.userClient.send({ cmd: 'user.getById' }, { id: data.userId }),
      );
      if (user) {
        await this.emailService.sendSubscriptionExpiredEmail(user.email, user.name, data.plan);
      }
      channel.ack(msg);
    } catch (error) {
      this.logger.error('handleSubscriptionExpired failed', error?.message);
      channel.nack(msg, false, false);
    }
  }

  @EventPattern('subscription.expiring_soon')
  async handleSubscriptionExpiringSoon(
    @Payload() data: { userId: string; plan: string; daysLeft: number; expiresAt: Date },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();
    try {
      const user = await firstValueFrom(
        this.userClient.send({ cmd: 'user.getById' }, { id: data.userId }),
      );
      if (user) {
        await this.emailService.sendSubscriptionExpiringSoonEmail(
          user.email,
          user.name,
          data.plan,
          data.daysLeft,
          data.expiresAt,
        );
      }
      channel.ack(msg);
    } catch (error) {
      this.logger.error('handleSubscriptionExpiringSoon failed', error?.message);
      channel.nack(msg, false, false);
    }
  }
}
