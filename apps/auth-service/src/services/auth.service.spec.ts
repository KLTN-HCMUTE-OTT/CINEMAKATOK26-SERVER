import { of, throwError } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';

import {
  InvalidCredentialsError,
  UserBannedError,
  UserNotFoundError,
} from '@app/common/exceptions';
import { PasswordHash } from '@app/common/utils/hash';

import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { SocialAuthService } from './social-auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let userClient: { send: jest.Mock };
  let orderClient: { send: jest.Mock };
  let notificationClient: { send: jest.Mock; emit: jest.Mock };
  let tokenService: jest.Mocked<Partial<TokenService>>;

  const activeUser = {
    id: 'u1',
    name: 'Alice',
    email: 'a@b.com',
    password: 'hashed',
    avatar: null,
    isAdmin: false,
    isBanned: false,
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    userClient = { send: jest.fn() };
    orderClient = { send: jest.fn() };
    notificationClient = { send: jest.fn(), emit: jest.fn() };
    tokenService = {
      generateTokens: jest
        .fn()
        .mockReturnValue({ accessToken: 'at', refreshToken: 'rt' }),
      saveRefreshToken: jest.fn().mockResolvedValue(undefined),
      removeRefreshToken: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'USER_SERVICE', useValue: userClient as unknown as ClientProxy },
        { provide: 'ORDER_SERVICE', useValue: orderClient as unknown as ClientProxy },
        {
          provide: 'NOTIFICATION_SERVICE',
          useValue: notificationClient as unknown as ClientProxy,
        },
        { provide: TokenService, useValue: tokenService },
        { provide: OtpService, useValue: { generateOtp: jest.fn() } },
        { provide: SocialAuthService, useValue: { verifyGoogleToken: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('returns a login response with tokens for valid credentials', async () => {
      userClient.send.mockReturnValue(of(activeUser));
      jest.spyOn(PasswordHash, 'comparePassword').mockReturnValue(true);

      const result = await service.login({
        email: 'a@b.com',
        password: 'plain',
      } as never);

      expect(result).toMatchObject({
        id: 'u1',
        name: 'Alice',
        token: { accessToken: 'at', refreshToken: 'rt' },
      });
      expect(tokenService.saveRefreshToken).toHaveBeenCalledWith('u1', 'rt');
    });

    it('throws InvalidCredentialsError when the password does not match', async () => {
      userClient.send.mockReturnValue(of(activeUser));
      jest.spyOn(PasswordHash, 'comparePassword').mockReturnValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' } as never),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it('throws UserBannedError when the account is banned', async () => {
      userClient.send.mockReturnValue(of({ ...activeUser, isBanned: true }));
      jest.spyOn(PasswordHash, 'comparePassword').mockReturnValue(true);

      await expect(
        service.login({ email: 'a@b.com', password: 'plain' } as never),
      ).rejects.toBeInstanceOf(UserBannedError);
    });

    it('maps a USER_NOT_FOUND rpc error to UserNotFoundError', async () => {
      userClient.send.mockReturnValue(
        throwError(() => ({ code: 'USER_NOT_FOUND' })),
      );

      await expect(
        service.login({ email: 'missing@b.com', password: 'x' } as never),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('logout / refresh', () => {
    it('logout removes the stored refresh token', async () => {
      await service.logout('u1');
      expect(tokenService.removeRefreshToken).toHaveBeenCalledWith('u1');
    });

    it('refresh delegates to the token service', async () => {
      const tokenReq = { refreshToken: 'rt' } as never;
      (tokenService.refresh as jest.Mock).mockResolvedValue({
        accessToken: 'new',
      });

      await service.refresh(tokenReq);

      expect(tokenService.refresh).toHaveBeenCalledWith(tokenReq);
    });
  });
});
