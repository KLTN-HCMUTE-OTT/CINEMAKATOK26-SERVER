import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { ReviewNotFoundError } from '@app/common/exceptions/domain.error';

import { ReviewService } from './review.service';
import { AuditLogEmitterService } from './audit-log-emitter.service';
import { EntityReview } from '../entities/review.entity';

describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepository: { findOne: jest.Mock };
  let userClient: { send: jest.Mock };

  beforeEach(async () => {
    reviewRepository = { findOne: jest.fn() };
    userClient = { send: jest.fn().mockReturnValue(of([])) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: getRepositoryToken(EntityReview, 'activity'),
          useValue: reviewRepository,
        },
        { provide: 'CONTENT_SERVICE', useValue: { send: jest.fn() } as unknown as ClientProxy },
        { provide: 'USER_SERVICE', useValue: userClient as unknown as ClientProxy },
        { provide: AuditLogEmitterService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReviewService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isReviewOwner', () => {
    it('throws ReviewNotFoundError when the review does not exist', async () => {
      reviewRepository.findOne.mockResolvedValue(null);

      await expect(service.isReviewOwner('missing', 'u1')).rejects.toBeInstanceOf(
        ReviewNotFoundError,
      );
    });

    it('returns true when the user owns the review', async () => {
      reviewRepository.findOne.mockResolvedValue({ userId: 'u1' });
      await expect(service.isReviewOwner('r1', 'u1')).resolves.toBe(true);
    });

    it('returns false when the user does not own the review', async () => {
      reviewRepository.findOne.mockResolvedValue({ userId: 'someone-else' });
      await expect(service.isReviewOwner('r1', 'u1')).resolves.toBe(false);
    });
  });

  describe('findReviewById', () => {
    it('throws ReviewNotFoundError for an unknown id', async () => {
      reviewRepository.findOne.mockResolvedValue(null);

      await expect(service.findReviewById('missing')).rejects.toBeInstanceOf(
        ReviewNotFoundError,
      );
    });
  });
});
