import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController (api-gateway)', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            socialLogin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('unwraps the auth-service observable and wraps it in a response envelope', async () => {
      const loginResult = {
        id: 'u1',
        name: 'Alice',
        avatar: null,
        isAdmin: false,
        token: { accessToken: 'at', refreshToken: 'rt' },
      };
      authService.login.mockReturnValue(of(loginResult) as never);

      const request = { email: 'a@b.com', password: 'pw' } as never;
      const response = await controller.login(request);

      expect(authService.login).toHaveBeenCalledWith(request);
      // ResponseBuilder wraps the payload under `data`
      expect(response).toHaveProperty('data');
      expect(response.data).toMatchObject({ id: 'u1', name: 'Alice' });
    });
  });
});
