import { Test, TestingModule } from '@nestjs/testing';

import { ContentController } from './content.controller';
import { ContentService } from './services/content.service';
import { MovieService } from './services/movie.service';
import { NewsService } from './services/news.service';
import { TvSeriesService } from './services/tvseries.service';
import { ActorService } from './services/actor.service';
import { DirectorService } from './services/director.service';
import { CategoryService } from './services/category.service';
import { TagService } from './services/tag.service';
import { VideoService } from './services/video.service';

describe('ContentController', () => {
  let controller: ContentController;
  let contentService: { findAll: jest.Mock };
  let movieService: { findAll: jest.Mock; findOne: jest.Mock; create: jest.Mock };

  const stub = () => ({ findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() });

  beforeEach(async () => {
    contentService = { findAll: jest.fn() };
    movieService = { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: MovieService, useValue: movieService },
        { provide: NewsService, useValue: stub() },
        { provide: TvSeriesService, useValue: stub() },
        { provide: ActorService, useValue: stub() },
        { provide: DirectorService, useValue: stub() },
        { provide: CategoryService, useValue: stub() },
        { provide: TagService, useValue: stub() },
        { provide: VideoService, useValue: stub() },
      ],
    }).compile();

    controller = module.get(ContentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getContents delegates to ContentService.findAll', () => {
    const query = { type: 'MOVIE' };
    controller.getContents(query);
    expect(contentService.findAll).toHaveBeenCalledWith(query);
  });

  it('getMovies delegates to MovieService.findAll', () => {
    controller.getMovies({ page: 1 });
    expect(movieService.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('getMovieById unwraps the id and calls MovieService.findOne', () => {
    controller.getMovieById({ id: 'm1' });
    expect(movieService.findOne).toHaveBeenCalledWith('m1');
  });

  it('createMovie forwards the dto to MovieService.create', () => {
    const dto = { title: 'New' } as never;
    controller.createMovie(dto);
    expect(movieService.create).toHaveBeenCalledWith(dto);
  });
});
