import { Repository } from 'typeorm/repository/Repository.js';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CreateNewsDto,
  UpdateNewsDto,
} from 'libs/common/src/dtos/content/news.dto';
import { EntityNews } from '../entities/news.entity';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(EntityNews, 'content')
    private newsRepository: Repository<EntityNews>,
  ) {}

  async findAll(query: any) {
    const { page = 1, limit = 10, sort, search } = query || {};

    const queryBuilder = this.newsRepository.createQueryBuilder('news');
    if (search) {
      queryBuilder
        .where(`similarity(news.title, :search) > 0.2`)
        .orWhere(`similarity(news.content_html, :search) > 0.2`)
        .setParameter('search', search)
        // ⚠️ orderBy phải dùng addSelect để tính toán similarity trước
        .addSelect(
          `
        GREATEST(
          similarity(news.title, :search),
          similarity(news.content_html, :search)
        )
      `,
          'rank',
        )
        .orderBy('rank', 'DESC');
    }

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.keys(sortObj).forEach((key) => {
        queryBuilder.addOrderBy(`news.${key}`, sortObj[key]);
      });
    } else {
      queryBuilder.orderBy('news.createdAt', 'DESC');
    }
    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total };
  }

  async findNewsRelated(id: string, query: any) {
    const { page = 1, limit = 10, sort } = query || {};

    // Lấy tin tức hiện tại
    const currentNews = await this.newsRepository.findOne({
      where: { id },
    });

    if (!currentNews) {
      throw new BadRequestException({
        message: 'News not found',
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }

    const queryBuilder = this.newsRepository.createQueryBuilder('news');

    // Loại trừ tin tức hiện tại
    queryBuilder.where('news.id != :id', { id });

    // Tìm tin tức có category trùng khớp
    if (currentNews.category && currentNews.category.length > 0) {
      queryBuilder.andWhere('news.category && :categories', {
        categories: currentNews.category,
      });
    }

    if (sort) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.keys(sortObj).forEach((key) => {
        queryBuilder.addOrderBy(`news.${key}`, sortObj[key]);
      });
    } else {
      queryBuilder.orderBy('news.createdAt', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total };
  }

  async findOne(id: string) {
    const news = await this.newsRepository.findOne({
      where: { id },
    });
    if (!news) {
      throw new BadRequestException({
        message: 'News not found',
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
    return news;
  }

  async create(newsData: CreateNewsDto): Promise<EntityNews> {
    const news = this.newsRepository.create({
      ...newsData,
    });
    const savedNews = await this.newsRepository.save(news);
    return this.findOne(savedNews.id);
  }

  async update(id: string, newsData: UpdateNewsDto): Promise<EntityNews> {
    const news = await this.findOne(id);
    Object.assign(news, newsData);
    const updatedNews = await this.newsRepository.save(news);
    return this.findOne(updatedNews.id);
  }

  async remove(id: string): Promise<void> {
    const news = await this.findOne(id);
    await this.newsRepository.remove(news);
  }
}
