import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class ContentService {
  constructor(
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
  ) {}

  getContents(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getContents' }, query)
      .pipe(catchRpcError());
  }

  getContentById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getContentById' }, { id })
      .pipe(catchRpcError());
  }

  createContent(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createContent' }, data)
      .pipe(catchRpcError());
  }

  updateContent(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateContent' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteContent(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteContent' }, { id })
      .pipe(catchRpcError());
  }

  getMovies(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getMovies' }, query)
      .pipe(catchRpcError());
  }

  getMovieById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getMovieById' }, { id })
      .pipe(catchRpcError());
  }

  getEpisodeById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getEpisodeById' }, { id })
      .pipe(catchRpcError());
  }

  getRelatedMovies(id: string, query?: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getRelatedMovies' }, { id, query })
      .pipe(catchRpcError());
  }

  getTrendingMovies(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTrendingMovies' }, query)
      .pipe(catchRpcError());
  }

  getMoviesByCategory(
    categoryId: string,
    query: Record<string, any>,
  ): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getMoviesByCategory' }, { categoryId, query })
      .pipe(catchRpcError());
  }

  createMovie(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createMovie' }, data)
      .pipe(catchRpcError());
  }

  updateMovie(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateMovie' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteMovie(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteMovie' }, { id })
      .pipe(catchRpcError());
  }

  getNews(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getNews' }, query)
      .pipe(catchRpcError());
  }

  getNewsById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getNewsById' }, { id })
      .pipe(catchRpcError());
  }

  getRelatedNews(id: string, query?: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getRelatedNews' }, { id, query })
      .pipe(catchRpcError());
  }

  createNews(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createNews' }, data)
      .pipe(catchRpcError());
  }

  updateNews(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateNews' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteNews(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteNews' }, { id })
      .pipe(catchRpcError());
  }

  getTvSeries(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTvSeries' }, query)
      .pipe(catchRpcError());
  }

  getTvSeriesById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTvSeriesById' }, { id })
      .pipe(catchRpcError());
  }

  getTrendingTvSeries(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTrendingTvSeries' }, query)
      .pipe(catchRpcError());
  }

  getTvSeriesByCategory(
    categoryId: string,
    query: Record<string, any>,
  ): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTvSeriesByCategory' }, { categoryId, query })
      .pipe(catchRpcError());
  }

  getTvSeriesWithNewEpisodes(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTvSeriesWithNewEpisodes' }, query)
      .pipe(catchRpcError());
  }

  getRelatedTvSeries(id: string, query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getRelatedTvSeries' }, { id, query })
      .pipe(catchRpcError());
  }

  createTvSeries(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createTvSeries' }, data)
      .pipe(catchRpcError());
  }

  updateTvSeries(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateTvSeries' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteTvSeries(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteTvSeries' }, { id })
      .pipe(catchRpcError());
  }

  getActors(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getActors' }, query)
      .pipe(catchRpcError());
  }

  getActorById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getActorById' }, { id })
      .pipe(catchRpcError());
  }

  searchActors(query: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.searchActors' }, { query })
      .pipe(catchRpcError());
  }

  getTopActors(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTopActors' }, query)
      .pipe(catchRpcError());
  }

  createActor(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createActor' }, data)
      .pipe(catchRpcError());
  }

  updateActor(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateActor' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteActor(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteActor' }, { id })
      .pipe(catchRpcError());
  }

  getDirectors(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getDirectors' }, query)
      .pipe(catchRpcError());
  }

  getDirectorById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getDirectorById' }, { id })
      .pipe(catchRpcError());
  }

  searchDirectors(query: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.searchDirectors' }, { query })
      .pipe(catchRpcError());
  }

  createDirector(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createDirector' }, data)
      .pipe(catchRpcError());
  }

  updateDirector(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateDirector' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteDirector(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteDirector' }, { id })
      .pipe(catchRpcError());
  }

  getCategories(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getCategories' }, query)
      .pipe(catchRpcError());
  }

  getCategoryById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getCategoryById' }, { id })
      .pipe(catchRpcError());
  }

  searchCategories(query: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.searchCategories' }, { query })
      .pipe(catchRpcError());
  }

  getCategoriesWithTvSeriesCount(): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getCategoriesWithTvSeriesCount' }, {})
      .pipe(catchRpcError());
  }

  createCategory(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createCategory' }, data)
      .pipe(catchRpcError());
  }

  updateCategory(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateCategory' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteCategory(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteCategory' }, { id })
      .pipe(catchRpcError());
  }

  getTags(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTags' }, query)
      .pipe(catchRpcError());
  }

  getTagById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getTagById' }, { id })
      .pipe(catchRpcError());
  }

  searchTags(query: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.searchTags' }, { query })
      .pipe(catchRpcError());
  }

  createTag(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createTag' }, data)
      .pipe(catchRpcError());
  }

  updateTag(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateTag' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteTag(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteTag' }, { id })
      .pipe(catchRpcError());
  }

  getVideos(query: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getVideos' }, query)
      .pipe(catchRpcError());
  }

  getVideoById(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.getVideoById' }, { id })
      .pipe(catchRpcError());
  }

  createVideo(data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.createVideo' }, data)
      .pipe(catchRpcError());
  }

  updateVideo(id: string, data: Record<string, any>): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.updateVideo' }, { id, data })
      .pipe(catchRpcError());
  }

  deleteVideo(id: string): Observable<any> {
    return this.contentClient
      .send({ cmd: 'content.deleteVideo' }, { id })
      .pipe(catchRpcError());
  }
}
