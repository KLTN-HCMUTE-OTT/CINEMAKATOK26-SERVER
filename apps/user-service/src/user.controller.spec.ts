import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { UserController } from './user.controller';
import { GetUserByEmailQuery } from './queries/impl/get-user-by-email.query';
import { GetUserByIdQuery } from './queries/impl/get-user-by-id.query';
import { GetUserByProviderIdQuery } from './queries/impl/get-user-by-providerId.query';

describe('UserController', () => {
  let controller: UserController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get(UserController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findByEmail dispatches a GetUserByEmailQuery', () => {
    controller.findByEmail({ email: 'a@b.com' });

    expect(queryBus.execute).toHaveBeenCalledTimes(1);
    expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetUserByEmailQuery);
  });

  it('getById dispatches a GetUserByIdQuery', () => {
    controller.getById({ id: 'u1' });

    expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetUserByIdQuery);
  });

  it('findByProviderId dispatches a GetUserByProviderIdQuery', () => {
    controller.findByProviderId({ providerId: 'google-123' });

    expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(
      GetUserByProviderIdQuery,
    );
  });

  it('returns whatever the query bus resolves', async () => {
    const user = { id: 'u1', name: 'Alice' };
    queryBus.execute.mockResolvedValue(user as never);

    await expect(controller.getById({ id: 'u1' })).resolves.toEqual(user);
  });
});
