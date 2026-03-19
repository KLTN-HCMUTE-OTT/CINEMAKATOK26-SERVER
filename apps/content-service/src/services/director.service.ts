import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CreateDirectorDto,
  UpdateDirectorDto,
} from 'libs/common/src/dtos/content/director.dto';
import { EntityDirector } from '../entities/actor.entity';

@Injectable()
export class DirectorService {
  constructor(
    @InjectRepository(EntityDirector, 'content')
    private readonly directorRepository: Repository<EntityDirector>,
  ) {}

  async create(createDirectorDto: CreateDirectorDto): Promise<EntityDirector> {
    const director = this.directorRepository.create(createDirectorDto);
    return await this.directorRepository.save(director);
  }

  async findAll(query?: any) {
    const { page = 1, limit = 10, sort, search } = query || {};

    const queryBuilder = this.directorRepository
      .createQueryBuilder('director')
      .leftJoinAndSelect('director.contents', 'contents');

    if (search) {
      queryBuilder
        .where(`similarity(director.name, :search) > 0.2`)
        .orWhere(`similarity(director.nationality, :search) > 0.2`)
        .setParameter('search', search)
        // thêm cột "rank" để sắp xếp theo độ giống cao nhất
        .addSelect(
          `
        GREATEST(
          similarity(director.name, :search),
          similarity(director.nationality, :search)
        )
      `,
          'rank',
        )
        .orderBy('rank', 'DESC');
    }

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.keys(sortObj).forEach((key) => {
        queryBuilder.addOrderBy(`director.${key}`, sortObj[key]);
      });
    } else if (!search) {
      queryBuilder.orderBy('director.createdAt', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<any> {
    const director = await this.directorRepository
      .createQueryBuilder('director')
      .leftJoinAndSelect('director.contents', 'content')
      .where('director.id = :id', { id })
      .getOne();

    if (!director) {
      throw new NotFoundException({
        message: `Director not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    // Get movie/tvseries IDs for each content
    if (director.contents && director.contents.length > 0) {
      const contentIds = director.contents.map((c) => c.id);

      // Query movies với duration
      const movies = await this.directorRepository.manager
        .createQueryBuilder()
        .select('movie.id', 'movieId')
        .addSelect('movie.content_id', 'contentId')
        .addSelect('movie.duration', 'duration')
        .from('movies', 'movie')
        .where('movie.content_id IN (:...contentIds)', { contentIds })
        .getRawMany();

      // Query tvseries (tạm thời duration = 0 cho tvseries)
      const tvseries = await this.directorRepository.manager
        .createQueryBuilder()
        .select('tvseries.id', 'tvseriesId')
        .addSelect('tvseries.content_id', 'contentId')
        .from('tvseries', 'tvseries')
        .where('tvseries.content_id IN (:...contentIds)', { contentIds })
        .getRawMany();

      // Create lookup maps
      const movieMap = new Map(
        movies.map((m) => [
          m.contentId,
          { id: m.movieId, duration: m.duration },
        ]),
      );
      const tvseriesMap = new Map(
        tvseries.map((t) => [t.contentId, { id: t.tvseriesId, duration: 0 }]),
      );

      // Attach movie/tvseries IDs to contents
      (director as any).contents = director.contents.map((content) => {
        const mediaInfo =
          content.type === 'MOVIE'
            ? movieMap.get(content.id)
            : tvseriesMap.get(content.id);

        return {
          ...content,
          movieOrSeriesId: mediaInfo?.id,
          duration: mediaInfo?.duration || 0,
        };
      });

      // Sort contents by release date (newest first)
      director.contents.sort((a: any, b: any) => {
        return (
          new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
        );
      });
    }

    return director;
  }
  async findById(id: string): Promise<EntityDirector> {
    const director = await this.directorRepository.findOne({
      where: { id },
    });
    if (!director) {
      throw new NotFoundException({
        message: `Director not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
    return director;
  }

  async validateDirectors(directors: any[]): Promise<void> {
    if (!directors || directors.length === 0) {
      return;
    }
    await Promise.all(
      directors.map(async (directorDto) => {
        if (!directorDto.id || directorDto.id.length === 0) {
          return;
        }
        await this.findById(directorDto.id);
      }),
    );
  }

  async update(
    id: string,
    updateDirectorDto: UpdateDirectorDto,
  ): Promise<EntityDirector> {
    const director = await this.findOne(id);
    Object.assign(director, updateDirectorDto);
    return await this.directorRepository.save(director);
  }

  async remove(id: string): Promise<void> {
    // First, remove all associations with contents
    await this.directorRepository
      .createQueryBuilder()
      .delete()
      .from('content_director')
      .where('director_id = :directorId', { directorId: id })
      .execute();

    // Then delete the director itself
    const result = await this.directorRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException({
        message: `Director not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
  }

  async search(query: string): Promise<EntityDirector[]> {
    return await this.directorRepository
      .createQueryBuilder('director')
      .leftJoinAndSelect('director.contents', 'contents')
      .where(
        `
      director.name ILIKE :likeQuery
      OR director.nationality ILIKE :likeQuery
      OR similarity(director.name, :query) > 0.3
      OR similarity(director.nationality, :query) > 0.3
    `,
        { likeQuery: `%${query}%`, query },
      )
      .orderBy(
        `
      GREATEST(similarity(director.name, :query),
               similarity(director.nationality, :query))`,
        'DESC',
      )
      .getMany();
  }
}
