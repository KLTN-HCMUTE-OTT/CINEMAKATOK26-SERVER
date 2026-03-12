import * as nodemailer from 'nodemailer';

import { Injectable, Logger } from '@nestjs/common';
import { getConfig } from '@app/common/utils/get-config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter;
  private readonly emailConfig = getConfig('email',{
    host: '',
    port: 0,
    fromName: '',
    secure: false,
    user: '',
    pass: '',
  });

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      fromName: this.emailConfig.fromName,
      secure: this.emailConfig.secure,
      auth: {
        user: this.emailConfig.user,
        pass: this.emailConfig.pass,
      },
    });
  }

  private renderOtpEmail(subject: string, otp: string, purpose: string): string {
    let content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.emailConfig.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0;">${subject}</h2>
          <p>Hello,</p>`;

    if (purpose === 'CHANGE_EMAIL') {
      content += `
          <p><strong>Someone is trying to change the email address for your account.</strong></p>
          <p>If this was you, please use the OTP code below to verify and complete the email change:</p>`;
    } else {
      content += `
          <p>Your OTP code is:</p>`;
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
      </div>
    `;

    return content;
  }

  private renderPasswordResetSuccess(subject: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #16a34a; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.emailConfig.fromName}</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="margin-top: 0;">${subject}</h2>
          <p>Your password has been successfully changed.</p>
          <p>If you did not request this, please contact support immediately.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>If you did not request this, please check your account.</p>
        </div>
      </div>
    `;
  }

  private renderUserBanNotification(
    userName: string,
    banReason: string,
    bannedUntil: Date,
  ): string {
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${this.emailConfig.fromName}</h1>
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
            <p style="color: #7f1d1d; margin-left: 10px; font-size: 16px; font-weight: bold;">
              ${formatDate(bannedUntil)}
            </p>
          </div>
          
          <p>Your account will be automatically reactivated after the suspension period ends.</p>
          <p>If you believe this suspension was made in error or would like to appeal, please contact our support team at <strong>support@cinemakatok.com</strong>.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© 2025 ${this.emailConfig.fromName}. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  async sendOtpEmail(email: string, otp: string, purpose: string): Promise<void> {
    try {
      const subject = this.getEmailSubject(purpose);
      const htmlContent = this.renderOtpEmail(subject, otp, purpose);

      await this.transporter.sendMail({
        from: `"${this.emailConfig.fromName}" <${this.emailConfig.user}>`,
        to: email,
        subject,
        html: htmlContent,
      });

      this.logger.log(`OTP email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
      throw new Error('Failed to send OTP email');
    }
  }

  async sendPasswordResetConfirmation(email: string): Promise<void> {
    try {
      const subject = 'Password Reset Confirmation';
      const htmlContent = this.renderPasswordResetSuccess(subject);

      await this.transporter.sendMail({
        from: `"${this.emailConfig.fromName}" <${this.emailConfig.user}>`,
        to: email,
        subject,
        html: htmlContent,
      });

      this.logger.log(`Password reset confirmation sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send confirmation email to ${email}`, error);
      throw new Error('Failed to send confirmation email');
    }
  }

  async sendUserBanNotification(
    email: string,
    userName: string,
    banReason: string,
    bannedUntil: Date,
  ): Promise<void> {
    try {
      const subject = 'Account Suspension Notification';
      const htmlContent = this.renderUserBanNotification(userName, banReason, bannedUntil);

      await this.transporter.sendMail({
        from: `"${this.emailConfig.fromName}" <${this.emailConfig.user}>`,
        to: email,
        subject,
        html: htmlContent,
      });

      this.logger.log(`User ban notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send ban notification to ${email}`, error);
      throw new Error('Failed to send ban notification');
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${this.emailConfig.fromName}" <${this.emailConfig.user}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw new Error('Failed to send email');
    }
  }

  private getEmailSubject(purpose: string): string {
    switch (purpose) {
      case 'FORGOT_PASSWORD':
        return 'Reset Your Password - OTP Code';
      case 'EMAIL_VERIFICATION':
        return 'Verify Your Email Address';
      case 'TWO_FACTOR_AUTH':
        return 'Two-Factor Authentication Code';
      case 'REGISTRATION':
        return 'Complete Your Registration - OTP Code';
      case 'CHANGE_EMAIL':
        return 'Email Change Verification - OTP Code';
      default:
        return 'Verification Code';
    }
  }
}
