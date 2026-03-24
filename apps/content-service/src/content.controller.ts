import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  CreateActorDto,
  UpdateActorDto,
} from 'libs/common/src/dtos/content/actor.dto';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from 'libs/common/src/dtos/content/category.dto';
import {
  CreateContentDto,
  UpdateContentDto,
} from 'libs/common/src/dtos/content/content.dto';
import {
  CreateDirectorDto,
  UpdateDirectorDto,
} from 'libs/common/src/dtos/content/director.dto';
import {
  CreateMovieDto,
  UpdateMovieDto,
} from 'libs/common/src/dtos/content/movies.dto';
import {
  CreateNewsDto,
  UpdateNewsDto,
} from 'libs/common/src/dtos/content/news.dto';
import {
  CreateTVSeriesDto,
  UpdateTVSeriesDto,
} from 'libs/common/src/dtos/content/tvseries.dto';
import {
  CreateTagDto,
  UpdateTagDto,
} from 'libs/common/src/dtos/content/tag.dto';
import {
  CreateVideoDto,
  UpdateVideoDto,
} from 'libs/common/src/dtos/content/video.dto';

import { ActorService } from './services/actor.service';
import { CategoryService } from './services/category.service';
import { ContentService } from './services/content.service';
import { DirectorService } from './services/director.service';
import { MovieService } from './services/movie.service';
import { NewsService } from './services/news.service';
import { TagService } from './services/tag.service';
import { TvSeriesService } from './services/tvseries.service';
import { VideoService } from './services/video.service';

@Controller()
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly movieService: MovieService,
    private readonly newsService: NewsService,
    private readonly tvSeriesService: TvSeriesService,
    private readonly actorService: ActorService,
    private readonly directorService: DirectorService,
    private readonly categoryService: CategoryService,
    private readonly tagService: TagService,
    private readonly videoService: VideoService,
  ) {}

  // ─── Content ─────────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getContents' })
  getContents(@Payload() query: Record<string, any>) {
    return this.contentService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getContentById' })
  getContentById(@Payload() payload: { id: string }) {
    return this.contentService.findContentById(payload.id);
  }

  @MessagePattern({ cmd: 'content.createContent' })
  createContent(@Payload() payload: CreateContentDto) {
    return this.contentService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateContent' })
  updateContent(@Payload() payload: { id: string; data: UpdateContentDto }) {
    return this.contentService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteContent' })
  deleteContent(@Payload() payload: { id: string }) {
    return this.contentService.delete(payload.id);
  }

  @MessagePattern({ cmd: 'content.getEntityIdByContentId' })
  getEntityIdByContentId(@Payload() payload: { contentId: string }) {
    return this.contentService.getIdOfTVOrMovie(payload.contentId);
  }

  // ─── Movies ───────────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getMovies' })
  getMovies(@Payload() query: Record<string, any>) {
    return this.movieService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getMovieById' })
  getMovieById(@Payload() payload: { id: string }) {
    return this.movieService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.getRelatedMovies' })
  getRelatedMovies(
    @Payload() payload: { id: string; query?: Record<string, any> },
  ) {
    return this.movieService.getRecommendationsByMovieId(
      payload.id,
      payload.query,
    );
  }

  @MessagePattern({ cmd: 'content.getTrendingMovies' })
  getTrendingMovies(@Payload() query: Record<string, any>) {
    return this.movieService.getTrendingMovies(query);
  }

  @MessagePattern({ cmd: 'content.getMoviesByCategory' })
  getMoviesByCategory(
    @Payload() payload: { categoryId: string; query?: Record<string, any> },
  ) {
    return this.movieService.getMoviesByCategory(
      payload.categoryId,
      payload.query,
    );
  }

  @MessagePattern({ cmd: 'content.createMovie' })
  createMovie(@Payload() payload: CreateMovieDto) {
    return this.movieService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateMovie' })
  updateMovie(@Payload() payload: { id: string; data: UpdateMovieDto }) {
    return this.movieService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteMovie' })
  deleteMovie(@Payload() payload: { id: string }) {
    return this.movieService.delete(payload.id);
  }

  // ─── News ───────────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getNews' })
  getNews(@Payload() query: Record<string, any>) {
    return this.newsService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getNewsById' })
  getNewsById(@Payload() payload: { id: string }) {
    return this.newsService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.getRelatedNews' })
  getRelatedNews(
    @Payload() payload: { id: string; query?: Record<string, any> },
  ) {
    return this.newsService.findNewsRelated(payload.id, payload.query);
  }

  @MessagePattern({ cmd: 'content.createNews' })
  createNews(@Payload() payload: CreateNewsDto) {
    return this.newsService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateNews' })
  updateNews(@Payload() payload: { id: string; data: UpdateNewsDto }) {
    return this.newsService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteNews' })
  deleteNews(@Payload() payload: { id: string }) {
    return this.newsService.remove(payload.id);
  }

  // ─── TV Series ────────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getTvSeries' })
  getTvSeries(@Payload() query: Record<string, any>) {
    return this.tvSeriesService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getTvSeriesById' })
  getTvSeriesById(@Payload() payload: { id: string }) {
    return this.tvSeriesService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.getTrendingTvSeries' })
  getTrendingTvSeries(@Payload() query: Record<string, any>) {
    return this.tvSeriesService.findTrending(query);
  }

  @MessagePattern({ cmd: 'content.getTvSeriesByCategory' })
  getTvSeriesByCategory(
    @Payload() payload: { categoryId: string; query?: Record<string, any> },
  ) {
    return this.tvSeriesService.findByCategoryId(
      payload.categoryId,
      payload.query,
    );
  }

  @MessagePattern({ cmd: 'content.getTvSeriesWithNewEpisodes' })
  getTvSeriesWithNewEpisodes(@Payload() query: Record<string, any>) {
    return this.tvSeriesService.findTvSeriesWithNewEpisodes(query);
  }

  @MessagePattern({ cmd: 'content.getRelatedTvSeries' })
  getRelatedTvSeries(
    @Payload() payload: { id: string; query?: Record<string, any> },
  ) {
    return this.tvSeriesService.getTVSeriesRecommendationsFromTVSeriesId(
      payload.id,
      payload.query,
    );
  }

  @MessagePattern({ cmd: 'content.createTvSeries' })
  createTvSeries(@Payload() payload: CreateTVSeriesDto) {
    return this.tvSeriesService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateTvSeries' })
  updateTvSeries(@Payload() payload: { id: string; data: UpdateTVSeriesDto }) {
    return this.tvSeriesService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteTvSeries' })
  deleteTvSeries(@Payload() payload: { id: string }) {
    return this.tvSeriesService.delete(payload.id);
  }

  // ─── Actors ──────────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getActors' })
  getActors(@Payload() query: Record<string, any>) {
    return this.actorService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getActorById' })
  getActorById(@Payload() payload: { id: string }) {
    return this.actorService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.searchActors' })
  searchActors(@Payload() payload: { query: string }) {
    return this.actorService.search(payload.query);
  }

  @MessagePattern({ cmd: 'content.getTopActors' })
  getTopActors(@Payload() query: Record<string, any>) {
    return this.actorService.getTopActors(query);
  }

  @MessagePattern({ cmd: 'content.createActor' })
  createActor(@Payload() payload: CreateActorDto) {
    return this.actorService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateActor' })
  updateActor(@Payload() payload: { id: string; data: UpdateActorDto }) {
    return this.actorService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteActor' })
  deleteActor(@Payload() payload: { id: string }) {
    return this.actorService.remove(payload.id);
  }

  // ─── Directors ───────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getDirectors' })
  getDirectors(@Payload() query: Record<string, any>) {
    return this.directorService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getDirectorById' })
  getDirectorById(@Payload() payload: { id: string }) {
    return this.directorService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.searchDirectors' })
  searchDirectors(@Payload() payload: { query: string }) {
    return this.directorService.search(payload.query);
  }

  @MessagePattern({ cmd: 'content.createDirector' })
  createDirector(@Payload() payload: CreateDirectorDto) {
    return this.directorService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateDirector' })
  updateDirector(@Payload() payload: { id: string; data: UpdateDirectorDto }) {
    return this.directorService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteDirector' })
  deleteDirector(@Payload() payload: { id: string }) {
    return this.directorService.remove(payload.id);
  }

  // ─── Categories ──────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getCategories' })
  getCategories(@Payload() query: Record<string, any>) {
    return this.categoryService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getCategoryById' })
  getCategoryById(@Payload() payload: { id: string }) {
    return this.categoryService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.searchCategories' })
  searchCategories(@Payload() payload: { query: string }) {
    return this.categoryService.search(payload.query);
  }

  @MessagePattern({ cmd: 'content.getCategoriesWithTvSeriesCount' })
  getCategoriesWithTvSeriesCount() {
    return this.categoryService.findAllWithTVSeriesCount();
  }

  @MessagePattern({ cmd: 'content.createCategory' })
  createCategory(@Payload() payload: CreateCategoryDto) {
    return this.categoryService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateCategory' })
  updateCategory(@Payload() payload: { id: string; data: UpdateCategoryDto }) {
    return this.categoryService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteCategory' })
  deleteCategory(@Payload() payload: { id: string }) {
    return this.categoryService.remove(payload.id);
  }

  // ─── Tags ────────────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getTags' })
  getTags(@Payload() query: Record<string, any>) {
    return this.tagService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getTagById' })
  getTagById(@Payload() payload: { id: string }) {
    return this.tagService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.searchTags' })
  searchTags(@Payload() payload: { query: string }) {
    return this.tagService.search(payload.query);
  }

  @MessagePattern({ cmd: 'content.createTag' })
  createTag(@Payload() payload: CreateTagDto) {
    return this.tagService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateTag' })
  updateTag(@Payload() payload: { id: string; data: UpdateTagDto }) {
    return this.tagService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteTag' })
  deleteTag(@Payload() payload: { id: string }) {
    return this.tagService.remove(payload.id);
  }

  // ─── Videos ──────────────────────────────────────────────────────────────────
  @MessagePattern({ cmd: 'content.getVideos' })
  getVideos(@Payload() query: Record<string, any>) {
    return this.videoService.findAll(query);
  }

  @MessagePattern({ cmd: 'content.getVideoById' })
  getVideoById(@Payload() payload: { id: string }) {
    return this.videoService.findOne(payload.id);
  }

  @MessagePattern({ cmd: 'content.createVideo' })
  createVideo(@Payload() payload: CreateVideoDto) {
    return this.videoService.create(payload);
  }

  @MessagePattern({ cmd: 'content.updateVideo' })
  updateVideo(@Payload() payload: { id: string; data: UpdateVideoDto }) {
    return this.videoService.update(payload.id, payload.data);
  }

  @MessagePattern({ cmd: 'content.deleteVideo' })
  deleteVideo(@Payload() payload: { id: string }) {
    return this.videoService.delete(payload.id);
  }
}
