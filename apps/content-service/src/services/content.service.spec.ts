import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ContentNotFoundError } from '@app/common/exceptions/domain.error';

import { ContentService } from './content.service';
import { ActorService } from './actor.service';
import { TagService } from './tag.service';
import { CategoryService } from './category.service';
import { DirectorService } from './director.service';
import { MovieService } from './movie.service';
import { EntityContent } from '../entities/content.entity';
import { EntityTVSeries } from '../entities/tvseries.entity';

describe('ContentService', () => {
  let service: ContentService;
  let contentRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    contentRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: getRepositoryToken(EntityContent, 'content'),
          useValue: contentRepository,
        },
        {
          provide: getRepositoryToken(EntityTVSeries, 'content'),
          useValue: { findOne: jest.fn() },
        },
        { provide: ActorService, useValue: { validateActors: jest.fn() } },
        { provide: TagService, useValue: { validateTags: jest.fn() } },
        { provide: CategoryService, useValue: { validateCategories: jest.fn() } },
        { provide: DirectorService, useValue: { validateDirectors: jest.fn() } },
        { provide: MovieService, useValue: { findByContentId: jest.fn() } },
      ],
    }).compile();

    service = module.get(ContentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findContentById', () => {
    it('returns the content when found', async () => {
      contentRepository.findOne.mockResolvedValue({ id: 'c1' });
      await expect(service.findContentById('c1')).resolves.toEqual({ id: 'c1' });
    });

    it('throws ContentNotFoundError when missing', async () => {
      contentRepository.findOne.mockResolvedValue(null);
      await expect(service.findContentById('missing')).rejects.toBeInstanceOf(
        ContentNotFoundError,
      );
    });
  });

  describe('delete', () => {
    it('removes the content when it exists', async () => {
      const content = { id: 'c1' };
      contentRepository.findOne.mockResolvedValue(content);

      await service.delete('c1');

      expect(contentRepository.remove).toHaveBeenCalledWith(content);
    });

    it('throws NotFoundException when the content is absent', async () => {
      contentRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(contentRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('increaseViewCount', () => {
    it('increments the stored view count by one', async () => {
      contentRepository.findOne.mockResolvedValue({ id: 'c1', viewCount: 41 });

      await expect(service.increaseViewCount('c1')).resolves.toBe(true);

      expect(contentRepository.update).toHaveBeenCalledWith(
        { id: 'c1' },
        { viewCount: 42 },
      );
    });
  });
});
