import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter;
  private readonly fromName: string;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.fromName = this.configService.get<string>('SMTP_FROM_NAME')!;
    this.fromEmail = this.configService.get<string>('SMTP_USER')!;
    const port = this.configService.get<number>('SMTP_PORT')!;
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST')!,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER')!,
        pass: this.configService.get<string>('SMTP_PASS')!,
      },
    });
  }

  // ─── Email Templates ──────────────────────────────────────────────────────────

  private renderOtpEmail(subject: string, otp: string, purpose: string): string {
    let content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0;">${subject}</h2>
          <p>Hello,</p>`;

    if (purpose === 'CHANGE_EMAIL') {
      content += `
          <p><strong>Someone is trying to change the email address for your account.</strong></p>
          <p>If this was you, please use the OTP code below to verify and complete the email change:</p>`;
    } else {
      content += `<p>Your OTP code is:</p>`;
    }

    content += `
          <div style="font-size: 24px; font-weight: bold; color: #4f46e5; margin: 20px 0; text-align: center;">
            ${otp}
          </div>
          <p>Purpose: <b>${purpose}</b></p>
          <p><i>Your OTP code will expire in <b>5 minutes</b>.</i></p>`;

    if (purpose === 'CHANGE_EMAIL') {
      content += `
          <p style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
            <strong>⚠️ Security Notice:</strong> If you did not request this email change, please ignore this email and consider changing your password immediately.
          </p>`;
    }

    content += `
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>If you did not request this, please ignore this email.</p>
        </div>
      </div>`;

    return content;
  }

  private renderPasswordResetSuccess(subject: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #16a34a; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0;">${subject}</h2>
          <p>Your password has been successfully changed.</p>
          <p>If you did not request this, please contact support immediately.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>If you did not request this, please check your account.</p>
        </div>
      </div>`;
  }

  private renderUserBanNotification(
    userName: string,
    banReason: string,
    bannedUntil: Date,
  ): string {
    const formatDate = (date: Date) =>
      new Date(date).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0; color: #dc2626;">⚠️ Account Suspension Notice</h2>
          <p>Dear ${userName},</p>
          <p style="color: #dc2626; font-weight: bold;">Your account has been suspended due to a violation of our Terms of Service.</p>
          <div style="margin: 20px 0; padding: 15px; background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #991b1b;">Suspension Details:</h3>
            <p><strong>Reason:</strong></p>
            <p style="color: #7f1d1d; margin-left: 10px;">${banReason}</p>
            <p><strong>Suspension Until:</strong></p>
            <p style="color: #7f1d1d; margin-left: 10px; font-size: 16px; font-weight: bold;">${formatDate(bannedUntil)}</p>
          </div>
          <p>Your account will be automatically reactivated after the suspension period ends.</p>
          <p>If you believe this suspension was made in error, please contact <strong>support@cinemakatok.com</strong>.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© 2025 ${this.fromName}. All rights reserved.</p>
        </div>
      </div>`;
  }

  // ─── Send Methods ─────────────────────────────────────────────────────────────

  async sendOtpEmail(email: string, otp: string, purpose: string): Promise<void> {
    const subject = this.getEmailSubject(purpose);
    const html = this.renderOtpEmail(subject, otp, purpose);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`OTP email sent to ${email}`);
  }

  async sendPasswordResetConfirmation(email: string): Promise<void> {
    const subject = 'Password Reset Confirmation';
    const html = this.renderPasswordResetSuccess(subject);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`Password reset confirmation sent to ${email}`);
  }

  private renderUserUnbanNotification(userName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0; color: #10b981;">Account Reactivated</h2>
          <p>Dear ${userName},</p>
          <p>Your account has been successfully reactivated. You can now log in and enjoy our services again.</p>
          <p>Thank you for your patience.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© 2025 ${this.fromName}. All rights reserved.</p>
        </div>
      </div>`;
  }

  async sendUserUnbanNotification(email: string, userName: string): Promise<void> {
    const subject = 'Account Reactivation Notification';
    const html = this.renderUserUnbanNotification(userName);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`Unban notification sent to ${email}`);
  }

  async sendBanNotification(
    email: string,
    userName: string,
    banReason: string,
    bannedUntil: Date,
  ): Promise<void> {
    const subject = 'Account Suspension Notification';
    const html = this.renderUserBanNotification(userName, banReason, bannedUntil);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`Ban notification sent to ${email}`);
  }

  async sendReportResult(
    email: string,
    userName: string,
    reportId: string,
    result: string,
  ): Promise<void> {
    const subject = 'Report Processing Result';
    const html = this.renderReportResult(userName, reportId, result);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`Report result email sent to ${email}`);
  }

  private renderReportResult(
    userName: string,
    reportId: string,
    result: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0;">Report Processing Result</h2>
          <p>Dear ${userName},</p>
          <p>We have processed your report (ID: <b>${reportId}</b>).</p>
          <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 5px;">
            <p><strong>Result:</strong></p>
            <p style="color: #374151;">${result}</p>
          </div>
          <p>Thank you for helping us keep our community safe.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>`;
  }

  private renderReviewBanNotification(
    userName: string,
    contentTitle: string,
    bannedContent: string,
    itemType: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0; color: #dc2626;">${itemType} Banned</h2>
          <p>Dear ${userName},</p>
          <p>Your ${itemType.toLowerCase()} for "<strong>${contentTitle}</strong>" has been banned due to violation of our community guidelines.</p>
          <div style="margin: 20px 0; padding: 15px; background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #991b1b;">Banned Content:</h3>
            <p style="color: #7f1d1d; font-style: italic;">"${bannedContent}"</p>
          </div>
          <p>If you believe this was in error, please contact support.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>`;
  }

  private renderReviewRestoreNotification(
    userName: string,
    itemDescription: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0; color: #10b981;">Content Restored</h2>
          <p>Dear ${userName},</p>
          <p>Good news! ${itemDescription} has been restored and is now visible again.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>`;
  }

  private renderSubscriptionExpired(userName: string, plan: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0; color: #dc2626;">Subscription Expired</h2>
          <p>Dear ${userName},</p>
          <p>Your <strong>${plan.toUpperCase()}</strong> subscription has expired.</p>
          <p>You no longer have access to premium features. Renew your subscription now to continue enjoying high-quality movies and exclusive content.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://cinemakatok.com/pricing" style="background-color: #dc2626; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Renew Now</a>
          </div>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>© 2025 ${this.fromName}. All rights reserved.</p>
        </div>
      </div>`;
  }

  private renderSubscriptionExpiringSoon(userName: string, plan: string, daysLeft: number, expiresAt: Date): string {
    const formatDate = (date: Date) => new Date(date).toLocaleDateString('vi-VN');
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0; color: #f59e0b;">Subscription Expiring Soon</h2>
          <p>Dear ${userName},</p>
          <p>Your <strong>${plan.toUpperCase()}</strong> subscription will expire in <strong>${daysLeft} days</strong> (on ${formatDate(expiresAt)}).</p>
          <p>Don't lose your access! Renew now to ensure uninterrupted service.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://cinemakatok.com/pricing" style="background-color: #f59e0b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Extend Subscription</a>
          </div>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>© 2025 ${this.fromName}. All rights reserved.</p>
        </div>
      </div>`;
  }

  async sendReviewBanNotification(
    email: string,
    userName: string,
    contentTitle: string,
    bannedContent: string,
    itemType: string,
  ): Promise<void> {
    const subject = `${itemType} Banned`;
    const html = this.renderReviewBanNotification(userName, contentTitle, bannedContent, itemType);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`${itemType} ban notification sent to ${email}`);
  }

  async sendReviewRestoreNotification(
    email: string,
    userName: string,
    itemDescription: string,
  ): Promise<void> {
    const subject = `${itemDescription} Restored`;
    const html = this.renderReviewRestoreNotification(userName, itemDescription);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`${itemDescription} restore notification sent to ${email}`);
  }

  async sendSubscriptionExpiredEmail(email: string, userName: string, plan: string): Promise<void> {
    const subject = 'Your Subscription has Expired';
    const html = this.renderSubscriptionExpired(userName, plan);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`Subscription expired email sent to ${email}`);
  }

  async sendSubscriptionExpiringSoonEmail(email: string, userName: string, plan: string, daysLeft: number, expiresAt: Date): Promise<void> {
    const subject = 'Your Subscription is Expiring Soon';
    const html = this.renderSubscriptionExpiringSoon(userName, plan, daysLeft, expiresAt);
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to: email, subject, html });
    this.logger.log(`Subscription expiring soon email sent to ${email}`);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.dispatch({ from: `"${this.fromName}" <${this.fromEmail}>`, to, subject, html });
    this.logger.log(`Email sent to ${to}`);
  }

  // ─── Internals ────────────────────────────────────────────────────────────────

  private async dispatch(mailOptions: nodemailer.SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      this.logger.error(`Failed to send email to ${mailOptions.to}`, error?.message);
      // Do NOT rethrow — notification failures are logged, not propagated
    }
  }

  private getEmailSubject(purpose: string): string {
    switch (purpose) {
      case 'FORGOT_PASSWORD':     return 'Reset Your Password - OTP Code';
      case 'EMAIL_VERIFICATION':  return 'Verify Your Email Address';
      case 'TWO_FACTOR_AUTH':     return 'Two-Factor Authentication Code';
      case 'REGISTRATION':        return 'Complete Your Registration - OTP Code';
      case 'CHANGE_EMAIL':        return 'Email Change Verification - OTP Code';
      default:                    return 'Verification Code';
    }
  }
}
