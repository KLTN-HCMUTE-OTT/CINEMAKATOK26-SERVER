import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ActorsController } from './controllers/actors.controller';
import { CategoriesController } from './controllers/categories.controller';
import { ContentsController } from './controllers/contents.controller';
import { DirectorsController } from './controllers/directors.controller';
import { EpisodesController } from './controllers/episodes.controller';
import { MoviesController } from './controllers/movies.controller';
import { TagsController } from './controllers/tags.controller';
import { TvSeriesController } from './controllers/tv-series.controller';
import { VideosController } from './controllers/videos.controller';
import { ContentService } from './content.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CONTENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.CONTENT_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.CONTENT_SERVICE_PORT ?? 3003),
        },
      },
    ]),
  ],
  controllers: [
    ContentsController,
    MoviesController,
    TvSeriesController,
    EpisodesController,
    ActorsController,
    DirectorsController,
    CategoriesController,
    TagsController,
    VideosController,
  ],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
