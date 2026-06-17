import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import * as path from 'path';

import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/core/database/database.module';

import { ContentController } from './content.controller';
import { EntityActor, EntityDirector } from './entities/actor.entity';
import { EntityCategory } from './entities/category.entity';
import { EntityContent } from './entities/content.entity';
import { EntityMovie } from './entities/movie.entity';
import { EntityNews } from './entities/news.entity';
import { EntityTag } from './entities/tag.entity';
import {
  EntityEpisode,
  EntitySeason,
  EntityTVSeries,
} from './entities/tvseries.entity';
import { EntityVideo } from './entities/video.entity';
import { ActorService } from './services/actor.service';
import { CategoryService } from './services/category.service';
import { ContentService } from './services/content.service';
import { validateContentEnv } from './config/env.schema';
import { DirectorService } from './services/director.service';
import { MovieService } from './services/movie.service';
import { NewsService } from './services/news.service';
import { RecommendService } from './services/recommend.service';
import { TagService } from './services/tag.service';
import { TvSeriesService } from './services/tvseries.service';
import { VideoService } from './services/video.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve('apps/content-service/.env'),
        path.resolve('.env'),
      ],
      validate: validateContentEnv,
      isGlobal: true,
    }),
    DatabaseModule.forRoot({ service: 'content' }),
    TypeOrmModule.forFeature(
      [
        EntityActor,
        EntityDirector,
        EntityCategory,
        EntityContent,
        EntityMovie,
        EntityNews,
        EntityTag,
        EntityTVSeries,
        EntitySeason,
        EntityEpisode,
        EntityVideo,
      ],
      'content',
    ),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
    CoreModule,
  ],
  controllers: [ContentController],
  providers: [
    ActorService,
    CategoryService,
    ContentService,
    DirectorService,
    MovieService,
    NewsService,
    RecommendService,
    TagService,
    TvSeriesService,
    VideoService,
  ],
})
export class ContentModule {}
