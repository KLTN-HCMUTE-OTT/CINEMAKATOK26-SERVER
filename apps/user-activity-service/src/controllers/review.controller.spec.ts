import { Test, TestingModule } from '@nestjs/testing';

import { ReviewController } from './review.controller';
import { ReviewService } from '../services/review.service';

describe('ReviewController', () => {
  let controller: ReviewController;
  let service: jest.Mocked<ReviewService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<ReviewService>> = {
      findReviews: jest.fn(),
      findReviewById: jest.fn(),
      createReview: jest.fn(),
      updateReview: jest.fn(),
      deleteReview: jest.fn(),
      isReviewOwner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: serviceMock }],
    }).compile();

    controller = module.get(ReviewController);
    service = module.get(ReviewService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findReviews forwards the pagination query', () => {
    const query = { page: 1, limit: 10 };
    controller.findReviews(query);
    expect(service.findReviews).toHaveBeenCalledWith(query);
  });

  it('findReviewById unwraps the id', () => {
    controller.findReviewById({ id: 'r1' });
    expect(service.findReviewById).toHaveBeenCalledWith('r1');
  });

  it('createReview splits userId from the dto before delegating', () => {
    controller.createReview({
      userId: 'u1',
      contentId: 'c1',
      rating: 5,
      comment: 'Great',
    } as never);

    expect(service.createReview).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ contentId: 'c1', rating: 5, comment: 'Great' }),
    );
    // userId must not leak into the dto argument
    expect(service.createReview.mock.calls[0][1]).not.toHaveProperty('userId');
  });

  it('updateReview splits id and userId from the dto', () => {
    controller.updateReview({
      id: 'r1',
      userId: 'u1',
      rating: 4,
    } as never);

    expect(service.updateReview).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ rating: 4 }),
      'u1',
    );
  });

  it('deleteReview passes id and userId', () => {
    controller.deleteReview({ id: 'r1', userId: 'u1' });
    expect(service.deleteReview).toHaveBeenCalledWith('r1', 'u1');
  });

  it('isReviewOwner passes id and userId', () => {
    controller.isReviewOwner({ id: 'r1', userId: 'u1' });
    expect(service.isReviewOwner).toHaveBeenCalledWith('r1', 'u1');
  });
});
