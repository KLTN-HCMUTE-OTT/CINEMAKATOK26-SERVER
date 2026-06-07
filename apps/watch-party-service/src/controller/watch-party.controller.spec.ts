import { Test, TestingModule } from '@nestjs/testing';

import { WatchPartyController } from './watch-party.controller';
import { WatchPartyService } from '../service/watch-party.service';

describe('WatchPartyController', () => {
  let controller: WatchPartyController;
  let service: jest.Mocked<WatchPartyService>;

  beforeEach(async () => {
    const serviceMock = {
      createRoom: jest.fn(),
      lookupInvite: jest.fn(),
      joinRoom: jest.fn(),
      joinRoomById: jest.fn(),
      leaveRoom: jest.fn(),
      closeRoom: jest.fn(),
      isHost: jest.fn(),
      getRoomState: jest.fn(),
      getRoomIdForUser: jest.fn(),
      syncVideo: jest.fn(),
      sendMessage: jest.fn(),
    } as unknown as jest.Mocked<WatchPartyService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatchPartyController],
      providers: [{ provide: WatchPartyService, useValue: serviceMock }],
    }).compile();

    controller = module.get(WatchPartyController);
    service = module.get(WatchPartyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createRoom forwards host id, input and host info', () => {
    const input = { title: 'Movie night' } as never;
    controller.createRoom({ hostId: 'h1', input, hostInfo: { displayName: 'H' } });
    expect(service.createRoom).toHaveBeenCalledWith('h1', input, {
      displayName: 'H',
    });
  });

  it('joinRoom forwards invite code, user, password and member', () => {
    controller.joinRoom({
      inviteCode: 'ABC',
      userId: 'u1',
      password: 'pw',
      member: { displayName: 'U' },
    });
    expect(service.joinRoom).toHaveBeenCalledWith('ABC', 'u1', 'pw', {
      displayName: 'U',
    });
  });

  describe('joinRoomById member normalization', () => {
    it('promotes the supplied member to admin when actorIsAdmin is true', () => {
      controller.joinRoomById({
        roomId: 'r1',
        userId: 'u1',
        member: { displayName: 'U', isAdmin: false },
        actorIsAdmin: true,
      });

      expect(service.joinRoomById).toHaveBeenCalledWith('r1', 'u1', undefined, {
        displayName: 'U',
        isAdmin: true,
      });
    });

    it('synthesizes an Admin member when actorIsAdmin is true and no member is supplied', () => {
      controller.joinRoomById({ roomId: 'r1', userId: 'u1', actorIsAdmin: true });

      expect(service.joinRoomById).toHaveBeenCalledWith('r1', 'u1', undefined, {
        displayName: 'Admin',
        isAdmin: true,
      });
    });

    it('passes undefined member for a normal user with no member payload', () => {
      controller.joinRoomById({ roomId: 'r1', userId: 'u1' });

      expect(service.joinRoomById).toHaveBeenCalledWith(
        'r1',
        'u1',
        undefined,
        undefined,
      );
    });
  });

  it('syncVideo forwards state and admin flag', () => {
    const state = { isPlaying: true, currentTime: 12 };
    controller.syncVideo({ roomId: 'r1', userId: 'u1', state, actorIsAdmin: true });
    expect(service.syncVideo).toHaveBeenCalledWith('r1', 'u1', state, true);
  });
});
