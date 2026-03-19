import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from 'libs/common/src/dtos/content/category.dto';
import { EntityCategory } from '../entities/category.entity';
import { ContentType } from '../entities/content.entity';

type SortDirection = 'ASC' | 'DESC';
type SortQuery = Record<string, SortDirection>;

interface CategoryListQuery {
  page?: number;
  limit?: number;
  sort?: string | SortQuery;
  search?: string;
}

interface CategoryReference {
  id?: string;
}

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(EntityCategory, 'content')
    private readonly categoryRepository: Repository<EntityCategory>,
  ) {}

  private throwCategoryNotFound(): never {
    throw new NotFoundException({
      message: 'Category not found',
      code: ERROR_CODE.ENTITY_NOT_FOUND,
    });
  }

  private parseSort(sort?: string | SortQuery): SortQuery {
    if (!sort) {
      return {};
    }

    return typeof sort === 'string' ? JSON.parse(sort) : sort;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<EntityCategory> {
    const category = this.categoryRepository.create(createCategoryDto);
    return await this.categoryRepository.save(category);
  }

  async findAll(query: CategoryListQuery = {}) {
    const { page = 1, limit = 10, sort, search } = query;

    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.contents', 'contents');

    if (search) {
      queryBuilder
        .where(`similarity(category.categoryName, :search) > 0.2`)
        .setParameter('search', search)
        .addSelect(`similarity(category.categoryName, :search)`, 'rank')
        .orderBy('rank', 'DESC');
    }

    if (sort) {
      const sortObj = this.parseSort(sort);
      Object.keys(sortObj).forEach((key) => {
        queryBuilder.addOrderBy(`category.${key}`, sortObj[key]);
      });
    } else if (!search) {
      queryBuilder.orderBy('category.createdAt', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<EntityCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['contents'],
    });

    if (!category) {
      this.throwCategoryNotFound();
    }
    return category;
  }

  async findById(id: string): Promise<EntityCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });
    if (!category) {
      this.throwCategoryNotFound();
    }
    return category;
  }

  async validateCategories(
    categoryDtos: CategoryReference[] = [],
  ): Promise<void> {
    if (!categoryDtos || categoryDtos.length === 0) {
      return;
    }
    await Promise.all(
      categoryDtos.map(async (categoryDto) => {
        if (!categoryDto.id || categoryDto.id.length === 0) {
          return;
        }
        await this.findById(categoryDto.id);
      }),
    );
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<EntityCategory> {
    const category = await this.findOne(id);
    Object.assign(category, updateCategoryDto);
    return await this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    // First, remove all associations with contents
    await this.categoryRepository
      .createQueryBuilder()
      .delete()
      .from('content_category')
      .where('category_id = :categoryId', { categoryId: id })
      .execute();

    // Then delete the category itself
    const result = await this.categoryRepository.delete(id);
    if (result.affected === 0) {
      this.throwCategoryNotFound();
    }
  }

  async search(query: string): Promise<EntityCategory[]> {
    return await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.contents', 'contents')
      .where(
        `
        category.categoryName ILIKE :likeQuery 
        OR similarity(category.categoryName, :query) > 0.3
        `,
        { likeQuery: `%${query}%`, query },
      )
      .orderBy('similarity(category.categoryName, :query)', 'DESC')
      .getMany();
  }

  async findAllWithTVSeriesCount() {
    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.contents', 'contents', 'contents.type = :type', {
        type: ContentType.TVSERIES,
      })
      .loadRelationCountAndMap(
        'category.tvSeriesCount',
        'category.contents',
        'contents',
        (qb) =>
          qb.where('contents.type = :type', { type: ContentType.TVSERIES }),
      )
      .getMany();
    return categories;
  }
}
