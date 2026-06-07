import { firstValueFrom, of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';

import { AuthService } from './auth.service';

describe('AuthService (api-gateway)', () => {
  let service: AuthService;
  let authClient: { send: jest.Mock };

  beforeEach(async () => {
    authClient = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'AUTH_SERVICE', useValue: authClient as unknown as ClientProxy },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('login proxies the request to the auth microservice via the auth.login cmd', async () => {
    const payload = { email: 'a@b.com', password: 'pw' } as never;
    authClient.send.mockReturnValue(of({ id: 'u1', token: {} }));

    const result = await firstValueFrom(service.login(payload));

    expect(authClient.send).toHaveBeenCalledWith({ cmd: 'auth.login' }, payload);
    expect(result).toMatchObject({ id: 'u1' });
  });

  it('socialLogin proxies via the auth.social-login cmd', async () => {
    const payload = { accessToken: 'google-token' } as never;
    authClient.send.mockReturnValue(of({ id: 'u2' }));

    const result = await firstValueFrom(service.socialLogin(payload));

    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: 'auth.social-login' },
      payload,
    );
    expect(result).toMatchObject({ id: 'u2' });
  });
});
