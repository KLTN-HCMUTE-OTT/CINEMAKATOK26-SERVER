import { of, throwError } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy, RmqContext } from '@nestjs/microservices';

import { NotificationController } from './notification.controller';
import { EmailService } from '../services/email.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let emailService: jest.Mocked<EmailService>;
  let userClient: { send: jest.Mock };

  let channel: { ack: jest.Mock; nack: jest.Mock };
  let context: RmqContext;
  const message = { content: 'msg' };

  beforeEach(async () => {
    const emailServiceMock: Partial<jest.Mocked<EmailService>> = {
      sendOtpEmail: jest.fn(),
      sendPasswordResetConfirmation: jest.fn(),
      sendBanNotification: jest.fn(),
      sendUserUnbanNotification: jest.fn(),
      sendEmail: jest.fn(),
      sendReportResult: jest.fn(),
      sendReviewBanNotification: jest.fn(),
      sendReviewRestoreNotification: jest.fn(),
      sendSubscriptionExpiredEmail: jest.fn(),
      sendSubscriptionExpiringSoonEmail: jest.fn(),
    };
    userClient = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: EmailService, useValue: emailServiceMock },
        { provide: 'USER_SERVICE', useValue: userClient as unknown as ClientProxy },
      ],
    }).compile();

    controller = module.get(NotificationController);
    emailService = module.get(EmailService);

    channel = { ack: jest.fn(), nack: jest.fn() };
    context = {
      getChannelRef: () => channel,
      getMessage: () => message,
    } as unknown as RmqContext;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendOtp', () => {
    it('sends the OTP email then acks the message on success', async () => {
      emailService.sendOtpEmail.mockResolvedValue(undefined);

      await controller.sendOtp(
        { email: 'a@b.com', otp: '123456', purpose: 'REGISTRATION' },
        context,
      );

      expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
        'a@b.com',
        '123456',
        'REGISTRATION',
      );
      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('nacks (and discards) the message when sending fails', async () => {
      emailService.sendOtpEmail.mockRejectedValue(new Error('smtp down'));

      await controller.sendOtp(
        { email: 'a@b.com', otp: '123456', purpose: 'REGISTRATION' },
        context,
      );

      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionExpired', () => {
    it('looks up the user then emails them and acks', async () => {
      userClient.send.mockReturnValue(of({ email: 'u@b.com', name: 'U' }));
      emailService.sendSubscriptionExpiredEmail.mockResolvedValue(undefined);

      await controller.handleSubscriptionExpired(
        { userId: 'u1', plan: 'premium' },
        context,
      );

      expect(userClient.send).toHaveBeenCalledWith(
        { cmd: 'user.getById' },
        { id: 'u1' },
      );
      expect(emailService.sendSubscriptionExpiredEmail).toHaveBeenCalledWith(
        'u@b.com',
        'U',
        'premium',
      );
      expect(channel.ack).toHaveBeenCalledWith(message);
    });

    it('still acks (skips email) when the user is not found', async () => {
      userClient.send.mockReturnValue(of(null));

      await controller.handleSubscriptionExpired(
        { userId: 'missing', plan: 'premium' },
        context,
      );

      expect(emailService.sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
      expect(channel.ack).toHaveBeenCalledWith(message);
    });

    it('nacks when the user lookup errors', async () => {
      userClient.send.mockReturnValue(throwError(() => new Error('rpc fail')));

      await controller.handleSubscriptionExpired(
        { userId: 'u1', plan: 'premium' },
        context,
      );

      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    });
  });
});
