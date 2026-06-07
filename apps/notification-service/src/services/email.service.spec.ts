import * as nodemailer from 'nodemailer';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let sendMail: jest.Mock;

  const config: Record<string, unknown> = {
    SMTP_FROM_NAME: 'CinemaKaTok',
    SMTP_USER: 'no-reply@cinemakatok.com',
    SMTP_HOST: 'smtp.test',
    SMTP_PORT: 587,
    SMTP_PASS: 'secret',
  };

  beforeEach(async () => {
    sendMail = jest.fn().mockResolvedValue({ messageId: 'id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined and configure the transport from config', () => {
    expect(service).toBeDefined();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test',
        port: 587,
        secure: false, // 587 is not 465
        auth: { user: 'no-reply@cinemakatok.com', pass: 'secret' },
      }),
    );
  });

  it('sendOtpEmail dispatches an email with the OTP in the body', async () => {
    await service.sendOtpEmail('user@b.com', '987654', 'REGISTRATION');

    expect(sendMail).toHaveBeenCalledTimes(1);
    const options = sendMail.mock.calls[0][0];
    expect(options.to).toBe('user@b.com');
    expect(options.subject).toContain('Registration');
    expect(options.html).toContain('987654');
    expect(options.from).toContain('CinemaKaTok');
  });

  it('sendEmail forwards the raw subject and html', async () => {
    await service.sendEmail('to@b.com', 'Hi', '<p>Body</p>');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'to@b.com',
        subject: 'Hi',
        html: '<p>Body</p>',
      }),
    );
  });

  it('swallows transport errors so notification failures never propagate', async () => {
    sendMail.mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      service.sendPasswordResetConfirmation('user@b.com'),
    ).resolves.toBeUndefined();
  });
});
