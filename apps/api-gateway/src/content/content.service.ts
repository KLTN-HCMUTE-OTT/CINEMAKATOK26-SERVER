import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

@Injectable()
export class ContentService {
  constructor(
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
  ) {}

  getMovies(query: Record<string, any>): Observable<any> {
    return this.contentClient.send({ cmd: 'content.getMovies' }, query);
  }

  getMovieById(id: string): Observable<any> {
    return this.contentClient.send({ cmd: 'content.getMovieById' }, { id });
  }

  getEpisodeById(id: string): Observable<any> {
    return this.contentClient.send({ cmd: 'content.getEpisodeById' }, { id });
  }

  getRelatedMovies(id: string): Observable<any> {
    return this.contentClient.send({ cmd: 'content.getRelatedMovies' }, { id });
  }
}
