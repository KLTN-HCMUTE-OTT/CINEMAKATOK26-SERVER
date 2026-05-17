import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CreateMovieDto,
  UpdateMovieDto,
} from 'libs/common/src/dtos/content/movies.dto';
import { EntityContent } from '../entities/content.entity';
import { EntityMovie } from '../entities/movie.entity';
import { VideoOwnerType } from '../entities/video.entity';
import { VideoService } from './video.service';

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(EntityMovie, 'content')
    private readonly movieRepository: Repository<EntityMovie>,
    @InjectRepository(EntityContent, 'content')
    private readonly contentRepository: Repository<EntityContent>,
    private readonly videoService: VideoService,
  ) {}

  /**
   * Helper gắn video vào movies
   */
  private async _attachVideosToMovies(movieList: EntityMovie[]) {
    const movieIds = movieList.map((m) => m.id).filter(Boolean);

    if (!movieIds?.length) return movieList;

    const videos = await this.videoService.findByMovieIds(movieIds);

    movieList.forEach((movie) => {
      // ✅ Chỉ gắn 1 video duy nhất thay vì mảng
      const video = videos.find((v) => v.ownerId === movie.id);
      movie['video'] = video || null;
    });

    return movieList;
  }

  async create(createMovieDto: CreateMovieDto): Promise<EntityMovie> {
    const queryRunner =
      this.movieRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { video, metaData, ...movieData } = createMovieDto;

      // First, create the content metadata
      const contentMetadata = this.contentRepository.create(metaData);
      await queryRunner.manager.save(contentMetadata);

      // Create the movie with the content metadata
      const movie = this.movieRepository.create({
        ...movieData,
        metaData: contentMetadata,
      });
      await queryRunner.manager.save(movie);

      // ✅ Xử lý video nếu có
      if (video) {
        const validVideos = await this.videoService.validateVideos([video]);
        if (!validVideos.length) {
          throw new BadRequestException({
            code: ERROR_CODE.INVALID_BODY,
            message: 'Video not found or invalid',
          });
        }

        await this.videoService.assignVideos(
          validVideos,
          movie.id,
          VideoOwnerType.MOVIE,
        );
      }

      await queryRunner.commitTransaction();

      return await this.findOne(movie.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private buildMovieQuery(
    query: any = {},
    extraSelect?: string,
    extraOrder?: string,
    categoryId?: string,
  ) {
    const { sort, search } = query;
    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors');

    if (categoryId) {
      qb.where('categories.id = :categoryId', { categoryId });
    }

    if (extraSelect) qb.addSelect(extraSelect, extraOrder || undefined);

    if (search && (typeof search !== 'string' || search.trim())) {
      const searchObj =
        typeof search === 'string' ? JSON.parse(search) : search;
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      Object.entries(searchObj).forEach(([key, value]) => {
        const field = key.includes('.') ? key : `metaData.${key}`;

        if (['title', 'description'].includes(key)) {
          // ✅ Tìm kiếm không phân biệt hoa thường + chuỗi con + similarity để xếp hạng
          conditions.push(
            `(LOWER(${field}) LIKE LOWER(:${key}) OR similarity(LOWER(${field}), LOWER(:${key})) > 0.2)`,
          );
          params[key] = `%${value}%`;
        } else if (key === 'releaseDate') {
          // ✅ Tìm theo năm
          conditions.push(`EXTRACT(YEAR FROM ${field}) = :${key}`);
          params[key] = value;
        } else {
          // ✅ fallback cho các field khác (so sánh chính xác)
          conditions.push(`${field} = :${key}`);
          params[key] = value;
        }
      });

      if (conditions.length > 0) {
        qb.where(conditions.join(' OR '))
          .setParameters(params)
          .addSelect(
            `GREATEST(${
              Object.keys(searchObj)
                .filter((k) => ['title', 'description'].includes(k))
                .map((k) => `similarity(LOWER(metaData.${k}), LOWER(:${k}))`)
                .join(', ') || '0'
            })`,
            'rank',
          )
          .orderBy('rank', 'DESC');
      }
    }

    if (sort && (typeof sort !== 'string' || sort.trim())) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.keys(sortObj).forEach((key) => {
        let field;
        if (['viewCount', 'avgRating'].includes(key)) {
          field = `metaData.${key}`;
        } else {
          field = key.includes('.') ? key : `movie.${key}`;
        }
        qb.addOrderBy(field, sortObj[key]);
      });
    } else if (!search && !extraOrder) {
      qb.orderBy('movie.createdAt', 'DESC');
    }

    return qb;
  }

  async findAll(query?: any) {
    const { page = 1, limit = 10 } = query || {};
    const qb = this.buildMovieQuery(query);
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const resultWithVideos = await this._attachVideosToMovies(data);
    return { data: resultWithVideos, total };
  }

  async findOne(id: string): Promise<EntityMovie> {
    const movie = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .where('movie.id = :id', { id })
      .getOne();

    if (!movie) {
      throw new NotFoundException({
        message: `Movie not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    const [movieWithVideo] = await this._attachVideosToMovies([movie]);
    return movieWithVideo;
  }

  async update(
    id: string,
    updateMovieDto: UpdateMovieDto,
  ): Promise<EntityMovie> {
    const queryRunner =
      this.movieRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movie = await this.findOne(id);
      const { video, metaData, ...movieData } = updateMovieDto;

      // Update content metadata if provided
      if (metaData) {
        await queryRunner.manager.save(this.contentRepository.target, {
          ...movie.metaData,
          ...metaData,
        });
      }

      // Update movie properties
      if (Object.keys(movieData).length > 0) {
        await queryRunner.manager.update(
          this.movieRepository.target,
          id,
          movieData,
        );
      }

      // ✅ Xử lý video
      if (video) {
        // Unlink video cũ trước
        await this.videoService.unassignVideosByMovieIds([id]);

        // Validate và assign video mới
        const validVideos = await this.videoService.validateVideos([video]);
        if (!validVideos.length) {
          throw new BadRequestException({
            code: ERROR_CODE.INVALID_BODY,
            message: 'Video not found or invalid',
          });
        }

        await this.videoService.assignVideos(
          validVideos,
          id,
          VideoOwnerType.MOVIE,
        );
      } else if (video === null || updateMovieDto.hasOwnProperty('video')) {
        // Nếu video = null hoặc được set trong request, unlink video hiện tại
        await this.videoService.unassignVideosByMovieIds([id]);
      }

      await queryRunner.commitTransaction();

      return await this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: string): Promise<void> {
    const queryRunner =
      this.movieRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movie = await queryRunner.manager.findOne(EntityMovie, {
        where: { id },
        relations: ['metaData'],
      });

      if (!movie) {
        throw new NotFoundException({
          message: `Movie not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }
      await this.videoService.unassignVideosByMovieIds([id]);
      await queryRunner.manager.remove(movie);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getTrendingMovies(query?: any) {
    const { page = 1, limit = 10 } = query || {};
    const epoch = new Date('2020-01-01T00:00:00Z').getTime() / 1000;
    const hotness = `
      LOG(10, COALESCE(metaData.viewCount, 0) + COALESCE(metaData.avgRating, 0) * 100 + 1) +
      ((EXTRACT(EPOCH FROM movie.createdAt) - ${epoch}) / 45000)
    `;
    const qb = this.buildMovieQuery(query, hotness, 'hotness');
    qb.orderBy('hotness', 'DESC');
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const resultWithVideos = await this._attachVideosToMovies(data);
    return { data: resultWithVideos, total };
  }

  async getMoviesByCategory(categoryId: string, query?: any) {
    const { page = 1, limit = 10 } = query || {};
    const qb = this.buildMovieQuery(query, undefined, undefined, categoryId);
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const resultWithVideos = await this._attachVideosToMovies(data);
    return { data: resultWithVideos, total };
  }

  async getRecommendationsByMovieId(movieId: string, query?: any) {
    const { page = 1, limit = 10 } = query || {};

    // Lấy thông tin movie hiện tại
    const currentMovie = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors')
      .where('movie.id = :movieId', { movieId })
      .getOne();

    if (!currentMovie) {
      throw new NotFoundException({
        message: `Movie not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    // Tạo query builder với similarity score
    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors')
      .where('movie.id != :movieId', { movieId });

    // Build similarity score
    const similarityParts: string[] = [];
    const params: Record<string, any> = { movieId };

    // 1. So sánh description (weight: 0.3)
    if (currentMovie.metaData?.description) {
      similarityParts.push(
        `(similarity(LOWER(metaData.description), LOWER(:description)) * 0.3)`,
      );
      params.description = currentMovie.metaData.description;
    }

    // 2. So sánh title (weight: 0.2)
    if (currentMovie.metaData?.title) {
      similarityParts.push(
        `(similarity(LOWER(metaData.title), LOWER(:title)) * 0.2)`,
      );
      params.title = currentMovie.metaData.title;
    }

    // 3. Cùng thể loại (weight: 0.25)
    const categoryIds =
      currentMovie.metaData?.categories?.map((c) => c.id) || [];
    if (categoryIds.length > 0) {
      qb.leftJoin('metaData.categories', 'matchCat');
      similarityParts.push(
        `(COALESCE(COUNT(DISTINCT CASE WHEN matchCat.id IN (:...categoryIds) THEN matchCat.id END), 0) * 0.25 / :categoryCount)`,
      );
      params.categoryIds = categoryIds;
      params.categoryCount = categoryIds.length;
    }

    // 4. Cùng diễn viên (weight: 0.15)
    const actorIds = currentMovie.metaData?.actors?.map((a) => a.id) || [];
    if (actorIds.length > 0) {
      qb.leftJoin('metaData.actors', 'matchActor');
      similarityParts.push(
        `(COALESCE(COUNT(DISTINCT CASE WHEN matchActor.id IN (:...actorIds) THEN matchActor.id END), 0) * 0.15 / :actorCount)`,
      );
      params.actorIds = actorIds;
      params.actorCount = actorIds.length;
    }

    // 5. Cùng đạo diễn (weight: 0.1)
    const directorIds =
      currentMovie.metaData?.directors?.map((d) => d.id) || [];
    if (directorIds.length > 0) {
      qb.leftJoin('metaData.directors', 'matchDirector');
      similarityParts.push(
        `(COALESCE(COUNT(DISTINCT CASE WHEN matchDirector.id IN (:...directorIds) THEN matchDirector.id END), 0) * 0.1 / :directorCount)`,
      );
      params.directorIds = directorIds;
      params.directorCount = directorIds.length;
    }

    // Tổng hợp similarity score
    const similarityScore =
      similarityParts.length > 0 ? similarityParts.join(' + ') : '0';

    qb.addSelect(`(${similarityScore})`, 'similarity_score')
      .setParameters(params)
      .groupBy('movie.id')
      .addGroupBy('metaData.id')
      .addGroupBy('categories.id')
      .addGroupBy('tags.id')
      .addGroupBy('actors.id')
      .addGroupBy('directors.id')
      .orderBy('similarity_score', 'DESC')
      .addOrderBy('metaData.avgRating', 'DESC') // Sắp xếp phụ theo rating
      .addOrderBy('metaData.viewCount', 'DESC'); // Và view count

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const resultWithVideos = await this._attachVideosToMovies(data);
    return { data: resultWithVideos, total };
  }

  async findByContentId(contentId: string): Promise<EntityMovie> {
    const movie = await this.movieRepository.findOne({
      where: { metaData: { id: contentId } },
      relations: ['metaData'],
    });
    if (!movie) {
      throw new NotFoundException({
        message: `Movie with Content ID ${contentId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
    return movie;
  }
}
