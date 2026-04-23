import { Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { PaginationQueryDto } from '@app/common/utils/dto/pagination-query.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CreateTagDto,
  UpdateTagDto,
} from 'libs/common/src/dtos/content/tag.dto';
import { EntityTag } from '../entities/tag.entity';

type SortDirection = 'ASC' | 'DESC';
type SortQuery = Record<string, SortDirection>;

interface TagReference {
  id?: string;
}

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(EntityTag, 'content')
    private readonly tagRepository: Repository<EntityTag>,
  ) {}

  private throwTagNotFound(): never {
    throw new NotFoundException({
      message: 'Tag not found',
      code: ERROR_CODE.ENTITY_NOT_FOUND,
    });
  }

  private parseSort(sort?: string | SortQuery): SortQuery {
    if (!sort) {
      return {};
    }

    return typeof sort === 'string' ? JSON.parse(sort) : sort;
  }

  async create(createTagDto: CreateTagDto): Promise<EntityTag> {
    const tag = this.tagRepository.create(createTagDto);
    return await this.tagRepository.save(tag);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<{ data: EntityTag[]; total: number }> {
    const { page = 1, limit = 10, sort, search } = query;

    const qb = this.tagRepository.createQueryBuilder('tag');
    qb.leftJoinAndSelect('tag.contents', 'contents');

    if (search) {
      qb.where(
        `
        tag.tagName ILIKE :likeQuery 
        OR similarity(tag.tagName, :query) > 0.3
        `,
        { likeQuery: `%${search}%`, query: search },
      );
    }
    if (sort) {
      const sortObj = this.parseSort(sort as string | SortQuery);
      Object.keys(sortObj).forEach((key) => {
        qb.addOrderBy(`tag.${key}`, sortObj[key]);
      });
    } else if (!search) {
      qb.orderBy('tag.createdAt', 'DESC');
    }
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<EntityTag> {
    const tag = await this.tagRepository.findOne({
      where: { id },
      relations: ['contents'],
    });

    if (!tag) {
      this.throwTagNotFound();
    }
    return tag;
  }
  async findById(id: string): Promise<EntityTag> {
    const tag = await this.tagRepository.findOne({ where: { id } });
    if (!tag) {
      this.throwTagNotFound();
    }
    return tag;
  }

  async validateTags(tagDtos: TagReference[] = []): Promise<void> {
    if (!tagDtos || tagDtos.length === 0) {
      return;
    }
    await Promise.all(
      tagDtos.map(async (tagDto) => {
        if (!tagDto.id || tagDto.id.length === 0) {
          return;
        }
        await this.findById(tagDto.id);
      }),
    );
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<EntityTag> {
    const tag = await this.findOne(id);
    Object.assign(tag, updateTagDto);
    return await this.tagRepository.save(tag);
  }

  async remove(id: string): Promise<void> {
    // First, remove all associations with contents
    await this.tagRepository
      .createQueryBuilder()
      .delete()
      .from('content_tag')
      .where('tag_id = :tagId', { tagId: id })
      .execute();

    // Then delete the tag itself
    const result = await this.tagRepository.delete(id);
    console.log('Delete result:', result);
    if (result.affected === 0) {
      this.throwTagNotFound();
    }
  }

  async search(query: string): Promise<EntityTag[]> {
    return await this.tagRepository
      .createQueryBuilder('tag')
      .leftJoinAndSelect('tag.contents', 'contents')
      .where(
        `
        tag.tagName ILIKE :likeQuery 
        OR similarity(tag.tagName, :query) > 0.3
        `,
        { likeQuery: `%${query}%`, query },
      )
      .orderBy('similarity(tag.tagName, :query)', 'DESC')
      .getMany();
  }
}
