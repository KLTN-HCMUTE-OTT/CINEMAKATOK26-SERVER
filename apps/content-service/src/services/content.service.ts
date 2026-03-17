import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ContentFilterDto,
  ContentSortBy,
  CreateContentDto,
  SortOrder,
  UpdateContentDto,
} from 'libs/common/src/dtos/content/content.dto';
import { ContentType, EntityContent } from '../entities/content.entity';
import { EntityTVSeries } from '../entities/tvseries.entity';
import { ActorService } from './actor.service';
import { CategoryService } from './category.service';
import { DirectorService } from './director.service';
import { MovieService } from './movie.service';
import { TagService } from './tag.service';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(EntityContent, 'content')
    private readonly contentRepository: Repository<EntityContent>,
    private readonly actorService: ActorService,
    private readonly tagService: TagService,
    private readonly categoryService: CategoryService,
    private readonly directorService: DirectorService,
    private readonly movieService: MovieService,
    @InjectRepository(EntityTVSeries, 'content')
    private readonly tvSeriesRepository: Repository<EntityTVSeries>,
  ) {}

  private async validateContentRelations(
    actorDtos?: Array<{ id?: string }>,
    tagDtos?: Array<{ id?: string }>,
    categoryDtos?: Array<{ id?: string }>,
    directorDtos?: Array<{ id?: string }>,
  ): Promise<void> {
    await this.actorService.validateActors(actorDtos || []);
    await this.tagService.validateTags(tagDtos || []);
    await this.categoryService.validateCategories(categoryDtos || []);
    await this.directorService.validateDirectors(directorDtos || []);
  }

  async create(createDto: CreateContentDto) {
    await this.validateContentRelations(
      createDto.actors,
      createDto.tags,
      createDto.categories,
      createDto.directors,
    );

    try {
      const content = this.contentRepository.create({
        ...createDto,
      });

      return await this.contentRepository.save(content);
    } catch (error) {
      console.error('Error creating content:', error);
      throw new BadRequestException({
        code: ERROR_CODE.UNEXPECTED_ERROR,
        message: 'Failed to create content',
        error: error.message,
      });
    }
  }

  async update(id: string, updateDto: UpdateContentDto) {
    try {
      if (!id) {
        throw new NotFoundException({
          code: ERROR_CODE.ENTITY_NOT_FOUND,
          message: 'Content Id is required',
        });
      }
      const content = await this.findContentById(id);

      await this.validateContentRelations(
        updateDto.actors,
        updateDto.tags,
        updateDto.categories,
        updateDto.directors,
      );

      Object.assign(content, {
        type: updateDto.type,
        title: updateDto.title,
        description: updateDto.description,
        releaseDate: updateDto.releaseDate,
        thumbnail: updateDto.thumbnail,
        banner: updateDto.banner,
        trailer: updateDto.trailer,
        categories: updateDto.categories,
        actors: updateDto.actors,
        directors: updateDto.directors,
        tags: updateDto.tags,
        imdbRating: updateDto.imdbRating,
        avgRating: updateDto.avgRating,
        viewCount: updateDto.viewCount,
      });

      return await this.contentRepository.save(content);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        code: ERROR_CODE.UNEXPECTED_ERROR,
        message: 'Failed to update content',
        error: error.message,
      });
    }
  }

  async delete(id: string) {
    const content = await this.findOne(id);
    if (!content) {
      throw new NotFoundException({
        code: ERROR_CODE.ENTITY_NOT_FOUND,
        message: 'Content not found',
      });
    }
    await this.contentRepository.remove(content);
  }

  async findAll(filter: ContentFilterDto) {
    const queryBuilder = this.contentRepository
      .createQueryBuilder('content')
      .leftJoinAndSelect('content.tags', 'tag')
      .leftJoinAndSelect('content.categories', 'category')
      .leftJoinAndSelect('content.actors', 'actor')
      .leftJoinAndSelect('content.directors', 'director');

    // Apply filters
    if (filter.type) {
      queryBuilder.andWhere('content.type = :type', { type: filter.type });
    }

    if (filter.tagIds?.length) {
      queryBuilder.andWhere('tag.id IN (:...tagIds)', {
        tagIds: filter.tagIds,
      });
    }

    if (filter.categoryIds?.length) {
      queryBuilder.andWhere('category.id IN (:...categoryIds)', {
        categoryIds: filter.categoryIds,
      });
    }

    if (filter.actorIds?.length) {
      queryBuilder.andWhere('actor.id IN (:...actorIds)', {
        actorIds: filter.actorIds,
      });
    }

    if (filter.directorIds?.length) {
      queryBuilder.andWhere('director.id IN (:...directorIds)', {
        directorIds: filter.directorIds,
      });
    }

    if (filter.year) {
      queryBuilder.andWhere('EXTRACT(YEAR FROM content.releaseDate) = :year', {
        year: filter.year,
      });
    }

    if (filter.title) {
      queryBuilder.andWhere('content.title ILIKE :title', {
        title: `%${filter.title}%`,
      });
    }

    // Apply sorting
    switch (filter.sortBy) {
      case ContentSortBy.VIEWS:
        queryBuilder.orderBy('content.viewCount', filter.order);
        break;
      case ContentSortBy.TITLE:
        queryBuilder.orderBy('content.title', filter.order);
        break;
      case ContentSortBy.DATE:
      default:
        queryBuilder.orderBy(
          'content.releaseDate',
          filter.order || SortOrder.DESC,
        );
        break;
    }

    // Apply pagination
    const page = filter.page || 1;
    const limit = filter.limit || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Split items into movies and TV series
    const movies = items.filter((item) => item.type === ContentType.MOVIE);
    const tvSeries = items.filter((item) => item.type === ContentType.TVSERIES);

    // Calculate totals for each type
    const totalMovies = movies.length;
    const totalTvSeries = tvSeries.length;

    return {
      items: {
        movies,
        tvSeries,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalMovies,
        totalTvSeries,
      },
    };
  }

  async findOne(id: string) {
    return this.contentRepository.findOne({
      where: { id },
      relations: ['tags', 'categories', 'actors', 'directors'],
    });
  }

  async findContentById(id: string) {
    const content = await this.contentRepository.findOne({
      where: { id },
    });
    if (!content) {
      throw new NotFoundException({
        message: `Content not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
    return content;
  }

  /**
   * Increase view count for content
   */
  async increaseViewCount(id: string): Promise<void> {
    const content = await this.findContentById(id);

    await this.contentRepository.update(
      { id },
      { viewCount: content.viewCount + 1 },
    );

    // Log the view count increase
    // await this.auditLogService.log({
    //   action: LOG_ACTION.CONTENT_VIEW_INCREASED,
    //   userId: 'System', // System-generated view count increase
    //   description: `View count increased for content: ${content.title} (ID: ${id})`,
    // });
  }

  async getIdOfTVOrMovie(contentId: string): Promise<string> {
    const content = await this.findContentById(contentId);
    if (content.type === ContentType.MOVIE) {
      const movie = await this.movieService.findByContentId(contentId);
      return movie.id;
    } else if (content.type === ContentType.TVSERIES) {
      const tvSeries = await this.tvSeriesRepository.findOne({
        where: { metaData: { id: contentId } },
      });
      if (!tvSeries) {
        throw new NotFoundException({
          message: `TV Series with content ID ${contentId} not found`,
          code: ERROR_CODE.ENTITY_NOT_FOUND,
        });
      }
      return tvSeries.id;
    }
    throw new BadRequestException({
      message: 'Content type is invalid',
      code: ERROR_CODE.UNEXPECTED_ERROR,
    });
  }
}
