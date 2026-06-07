import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AuthService>> = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      sendRegisterOtp: jest.fn(),
      registerVerify: jest.fn(),
      resendRegisterOtp: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      resendForgotPasswordOtp: jest.fn(),
      socialLogin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: serviceMock }],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('login forwards the auth request payload', () => {
    const payload = { email: 'a@b.com', password: 'pw' } as never;
    controller.login(payload);
    expect(service.login).toHaveBeenCalledWith(payload);
  });

  it('refresh forwards the token request', () => {
    const payload = { refreshToken: 'rt' } as never;
    controller.refresh(payload);
    expect(service.refresh).toHaveBeenCalledWith(payload);
  });

  it('logout unwraps the userId from the payload', () => {
    controller.logout({ userId: 'u1' });
    expect(service.logout).toHaveBeenCalledWith('u1');
  });

  it('resendRegisterOtp unwraps the email from the payload', () => {
    controller.resendRegisterOtp({ email: 'a@b.com' });
    expect(service.resendRegisterOtp).toHaveBeenCalledWith('a@b.com');
  });

  it('socialLogin forwards the social login request', () => {
    const payload = { accessToken: 'google-token' } as never;
    controller.socialLogin(payload);
    expect(service.socialLogin).toHaveBeenCalledWith(payload);
  });
});
