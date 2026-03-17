import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';

import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/core/database/database.module';

import { ContentController } from './content.controller';
import { EntityActor, EntityDirector } from './entities/actor.entity';
import { EntityCategory } from './entities/category.entity';
import { EntityContent } from './entities/content.entity';
import { EntityMovie } from './entities/movie.entity';
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
        EntityTag,
        EntityTVSeries,
        EntitySeason,
        EntityEpisode,
        EntityVideo,
      ],
      'content',
    ),
    CoreModule,
  ],
  controllers: [ContentController],
  providers: [
    ActorService,
    CategoryService,
    ContentService,
    DirectorService,
    MovieService,
    TagService,
    TvSeriesService,
    VideoService,
  ],
})
export class ContentModule {}
