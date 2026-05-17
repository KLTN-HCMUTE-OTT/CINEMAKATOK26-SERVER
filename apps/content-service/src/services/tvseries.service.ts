import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  CreateTVSeriesDto,
  UpdateTVSeriesDto,
} from 'libs/common/src/dtos/content/tvseries.dto';
import { UpdateVideoDto } from 'libs/common/src/dtos/content/video.dto';
import { ContentType } from '../entities/content.entity';
import {
  EntityEpisode,
  EntitySeason,
  EntityTVSeries,
} from '../entities/tvseries.entity';
import { EntityVideo, VideoOwnerType } from '../entities/video.entity';
import { ContentService } from './content.service';
import { VideoService } from './video.service';
import { ContentNotFoundError } from '@app/common/exceptions/domain.error';

@Injectable()
export class TvSeriesService {
  constructor(
    @InjectRepository(EntityTVSeries, 'content')
    private readonly tvSeriesRepository: Repository<EntityTVSeries>,
    private readonly contentService: ContentService,
    @InjectRepository(EntitySeason, 'content')
    private readonly seasonRepository: Repository<EntitySeason>,
    @InjectRepository(EntityEpisode, 'content')
    private readonly episodeRepository: Repository<EntityEpisode>,
    private readonly videoService: VideoService,
  ) {}

  /**
   * Áp dụng filter theo thời gian cho releaseDate của TV series
   */
  private _applyDateRange(qb: SelectQueryBuilder<EntityTVSeries>, filter) {
    const filterObj = typeof filter === 'string' ? JSON.parse(filter) : filter;
    const { range } = filterObj || {};
    let computedStart: Date | undefined;
    let computedEnd: Date | undefined;

    if (!computedStart && range) {
      const now = new Date();
      const normalizeStart = (date: Date) => {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
      };

      const normalizeEnd = (date: Date) => {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
      };

      switch (range) {
        case 'today':
          computedStart = normalizeStart(now);
          computedEnd = normalizeEnd(now);
          break;
        case 'week':
          const weekStart = new Date(now);
          const day = weekStart.getDay();
          const diff = (day + 6) % 7; // assuming week starts on Monday
          weekStart.setDate(weekStart.getDate() - diff);
          computedStart = normalizeStart(weekStart);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          computedEnd = normalizeEnd(weekEnd);
          break;
        case 'month':
          computedStart = normalizeStart(
            new Date(now.getFullYear(), now.getMonth(), 1),
          );
          computedEnd = normalizeEnd(
            new Date(now.getFullYear(), now.getMonth() + 1, 0),
          );
          break;
        case 'year':
          computedStart = normalizeStart(new Date(now.getFullYear(), 0, 1));
          computedEnd = normalizeEnd(new Date(now.getFullYear(), 11, 31));
          break;
      }
    }

    if (computedStart) {
      qb.andWhere('metaData.releaseDate >= :startDate', {
        startDate: computedStart,
      });
    }

    if (computedEnd) {
      qb.andWhere('metaData.releaseDate <= :endDate', { endDate: computedEnd });
    }
  }

  private _buildSeriesQuery(
    query: any,
    options: {
      includeHotness?: boolean;
      defaultOrder?: { field: string; direction: 'ASC' | 'DESC' };
    } = {},
  ): SelectQueryBuilder<EntityTVSeries> {
    const { includeHotness, defaultOrder } = options;
    const { sort, search, filter } = query || {};

    const qb = this.tvSeriesRepository
      .createQueryBuilder('tvseries')
      .leftJoinAndSelect('tvseries.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors')
      .loadRelationCountAndMap('tvseries.totalSeasons', 'tvseries.seasons');

    if (includeHotness) {
      const epoch = new Date('2020-01-01T00:00:00Z').getTime() / 1000;
      const hotness = `
        LOG(10, COALESCE(metaData.viewCount, 0) + COALESCE(metaData.avgRating, 0) * 100 + 1) +
        ((EXTRACT(EPOCH FROM tvseries.createdAt) - ${epoch}) / 45000)
      `;
      qb.addSelect(hotness, 'hotness');
    }

    if (search) {
      qb.andWhere(
        new Brackets((bracketQb) =>
          bracketQb
            .where(`similarity(metaData.title, :search) > 0.2`)
            .orWhere(`similarity(metaData.description, :search) > 0.2`),
        ),
      )
        .setParameter('search', search)
        .addSelect(
          `GREATEST(
            similarity(metaData.title, :search),
            similarity(metaData.description, :search)
          )`,
          'rank',
        )
        .orderBy('rank', 'DESC');
    }
    if (filter) {
      this._applyDateRange(qb, filter);
    }

    if (sort && (typeof sort !== 'string' || sort.trim())) {
      const sortObj = typeof sort === 'string' ? JSON.parse(sort) : sort;
      Object.keys(sortObj).forEach((key) => {
        let field;
        if (['viewCount', 'avgRating', 'releaseDate'].includes(key)) {
          field = `metaData.${key}`;
        } else {
          field = key.includes('.') ? key : `tvseries.${key}`;
        }
        qb.addOrderBy(field, sortObj[key]);
      });
    } else if (!search && !defaultOrder) {
      qb.orderBy('tvseries.metaData.releaseDate', 'DESC');
    }

    return qb;
  }

  /**
   * Helper gắn video vào episodes
   */
  private async _attachVideosToEpisodes(tvSeriesList: EntityTVSeries[]) {
    const episodeIds = tvSeriesList
      .flatMap((tv) =>
        tv.seasons?.flatMap((s) => s.episodes?.map((ep) => ep.id)),
      )
      .filter(Boolean);

    if (!episodeIds?.length) return tvSeriesList;

    const videos = await this.videoService.findByEpisodeIds(episodeIds);

    tvSeriesList.forEach((tv) =>
      tv.seasons?.forEach((season) =>
        season.episodes?.forEach((ep) => {
          // ✅ Chỉ gắn 1 video duy nhất thay vì mảng
          const video = videos.find((v) => v.ownerId === ep.id);
          ep['video'] = video || null;
        }),
      ),
    );

    return tvSeriesList;
  }

  /**
   * Lấy danh sách TV series (có gắn videos)
   */
  async findAll(query?: any) {
    const { page = 1, limit = 10 } = query || {};
    const qb = this._buildSeriesQuery(query, {
      defaultOrder: {
        field: 'tvseries.metaData.releaseDate',
        direction: 'DESC',
      },
    });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: data, total };
  }

  /**
   * Lấy list TV series trending
   */
  async findTrending(query?: any) {
    const { page = 1, limit = 10 } = query || {};
    const qb = this._buildSeriesQuery(query, {
      includeHotness: true,
      defaultOrder: {
        field: 'tvseries.metaData.releaseDate',
        direction: 'DESC',
      },
    });
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: data, total };
  }

  async findByCategoryId(categoryId: string, query?: any) {
    const { page = 1, limit = 10 } = query || {};
    const qb = this._buildSeriesQuery(query, {
      defaultOrder: {
        field: 'tvseries.metaData.releaseDate',
        direction: 'DESC',
      },
    });
    qb.andWhere('categories.id = :categoryId', { categoryId });
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: data, total };
  }

  async findTvSeriesWithNewEpisodes(query?: any) {
    const { page = 1, limit = 10 } = query || {};
    const qb = this._buildSeriesQuery(query, {
      defaultOrder: { field: 'metaData.releaseDate', direction: 'DESC' },
    });

    // Join với seasons và episodes (KHÔNG join video vì không có relation)
    qb.leftJoinAndSelect('tvseries.seasons', 'seasons').leftJoinAndSelect(
      'seasons.episodes',
      'episodes',
    );

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Transform data để lấy latestEpisode và attach video
    const result = await Promise.all(
      data.map(async (series) => {
        let latestEpisode: EntityEpisode | null = null;

        if (series.seasons && series.seasons.length > 0) {
          // Tìm episode mới nhất dựa trên createdAt
          const allEpisodes = series.seasons
            .flatMap((season) => season.episodes || [])
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );

          latestEpisode = allEpisodes[0] || null;

          // ✅ Load video cho latestEpisode qua ownerId và ownerType
          if (latestEpisode) {
            const video = await this.videoService.findByOwner(
              latestEpisode.id,
              VideoOwnerType.EPISODE,
            );
            latestEpisode['video'] = video || null;
          }
        }

        // Remove seasons để match với TVSeriesWithNewEpisode DTO
        const { seasons, ...seriesWithoutSeasons } = series;

        return {
          ...seriesWithoutSeasons,
          latestEpisode,
        };
      }),
    );

    return { data: result, total };
  }
  async getTVSeriesRecommendationsFromTVSeriesId(
    tvSeriesId: string,
    query?: any,
  ) {
    const { page = 1, limit = 10 } = query || {};
    // lay thong tin tvseries hien tai
    const tvseries = await this.findOne(tvSeriesId);

    // so sanh the loai va tag de lay danh sach giong nhau
    //Tạo query builder với similarity score
    const qb = this.tvSeriesRepository
      .createQueryBuilder('tvseries')
      .leftJoinAndSelect('tvseries.metaData', 'metaData')
      .leftJoinAndSelect('metaData.categories', 'categories')
      .leftJoinAndSelect('metaData.tags', 'tags')
      .leftJoinAndSelect('metaData.actors', 'actors')
      .leftJoinAndSelect('metaData.directors', 'directors')
      .where('tvseries.id != :tvSeriesId', { tvSeriesId });

    // Build similarity score
    const similarityParts: string[] = [];
    const params: Record<string, any> = { tvSeriesId };
    // 1. So sánh description (weight: 0.3)
    if (tvseries.metaData?.description) {
      similarityParts.push(
        `(similarity(LOWER(metaData.description), LOWER(:description)) * 0.3)`,
      );
      params.description = tvseries.metaData.description;
    }

    // 2. So sánh title (weight: 0.2)
    if (tvseries.metaData?.title) {
      similarityParts.push(
        `(similarity(LOWER(metaData.title), LOWER(:title)) * 0.2)`,
      );
      params.title = tvseries.metaData.title;
    }

    // 3. Cùng thể loại (weight: 0.25)
    const categoryIds = tvseries.metaData?.categories?.map((c) => c.id) || [];
    if (categoryIds.length > 0) {
      qb.leftJoin('metaData.categories', 'matchCat');
      similarityParts.push(
        `(COALESCE(COUNT(DISTINCT CASE WHEN matchCat.id IN (:...categoryIds) THEN matchCat.id END), 0) * 0.25 / :categoryCount)`,
      );
      params.categoryIds = categoryIds;
      params.categoryCount = categoryIds.length;
    }

    // 4. Cùng diễn viên (weight: 0.15)
    const actorIds = tvseries.metaData?.actors?.map((a) => a.id) || [];
    if (actorIds.length > 0) {
      qb.leftJoin('metaData.actors', 'matchActor');
      similarityParts.push(
        `(COALESCE(COUNT(DISTINCT CASE WHEN matchActor.id IN (:...actorIds) THEN matchActor.id END), 0) * 0.15 / :actorCount)`,
      );
      params.actorIds = actorIds;
      params.actorCount = actorIds.length;
    }

    // 5. Cùng đạo diễn (weight: 0.1)
    const directorIds = tvseries.metaData?.directors?.map((d) => d.id) || [];
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
      .groupBy('tvseries.id')
      .addGroupBy('metaData.id')
      .addGroupBy('categories.id')
      .addGroupBy('tags.id')
      .addGroupBy('actors.id')
      .addGroupBy('directors.id')
      .orderBy('similarity_score', 'DESC')
      .addOrderBy('metaData.avgRating', 'DESC') // Sắp xếp phụ theo rating
      .addOrderBy('metaData.viewCount', 'DESC') // Và view count
      .loadRelationCountAndMap('tvseries.totalSeasons', 'tvseries.seasons');

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: data, total };
  }

  /**
   * Lấy 1 TV series chi tiết
   */
  async findOne(id: string) {
    const tvSeries = await this.tvSeriesRepository
      .createQueryBuilder('tv')
      .leftJoinAndSelect('tv.metaData', 'meta')
      .leftJoinAndSelect('meta.categories', 'categories')
      .leftJoinAndSelect('meta.tags', 'tags')
      .leftJoinAndSelect('meta.actors', 'actors')
      .leftJoinAndSelect('meta.directors', 'directors')
      .leftJoinAndSelect('tv.seasons', 'seasons')
      .leftJoinAndSelect('seasons.episodes', 'episodes')
      .where('tv.id = :id', { id })
      .getOne();

    if (!tvSeries) {
      throw new NotFoundException({
        code: ERROR_CODE.ENTITY_NOT_FOUND,
        message: 'TV series not found',
      });
    }

    const [tvSeriesWithVideos] = await this._attachVideosToEpisodes([tvSeries]);
    return tvSeriesWithVideos;
  }

  async findEpisodeById(id: string) {
    const episode = await this.episodeRepository.findOne({ where: { id } });
    if(!episode){
      throw new ContentNotFoundError();
    }
    return episode;
  }

  /**
   * Tạo mới
   */
  async create(createDto: CreateTVSeriesDto): Promise<EntityTVSeries> {
    const queryRunner =
      this.tvSeriesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { seasons = [], metaData } = createDto;

      const content = await this.contentService.create({
        ...metaData,
        type: ContentType.TVSERIES,
      });

      const tvSeries = this.tvSeriesRepository.create({ metaData: content });
      await queryRunner.manager.save(tvSeries);

      if (seasons.length) {
        const seasonEntities = seasons.map((seasonDto) =>
          this.seasonRepository.create({
            seasonNumber: seasonDto.seasonNumber,
            totalEpisodes: seasonDto.episodes?.length ?? 0,
            tvseries: tvSeries,
          }),
        );
        await queryRunner.manager.save(seasonEntities);

        const episodeEntities: EntityEpisode[] = [];
        const episodeVideoRequests: Array<{
          episode: EntityEpisode;
          video: UpdateVideoDto;
        }> = [];

        seasonEntities.forEach((seasonEntity, index) => {
          const seasonDto = seasons[index];
          const episodes = seasonDto.episodes ?? [];

          episodes.forEach((episodeDto) => {
            const episode = this.episodeRepository.create({
              ...episodeDto,
              season: seasonEntity,
            });

            episodeEntities.push(episode);

            // ✅ Chỉ xử lý 1 video thay vì mảng
            if (episodeDto.video) {
              episodeVideoRequests.push({
                episode,
                video: episodeDto.video,
              });
            }
          });
        });

        if (episodeEntities.length) {
          await queryRunner.manager.save(episodeEntities);
        }

        if (episodeVideoRequests.length) {
          const videoDtos = episodeVideoRequests.map(
            (request) => request.video,
          );
          const validVideos = await this.videoService.validateVideos(videoDtos);
          const videoMap = new Map(
            validVideos.map((video) => [video.id, video]),
          );

          for (const request of episodeVideoRequests) {
            if (!request.video.id) {
              throw new BadRequestException({
                code: ERROR_CODE.INVALID_BODY,
                message: 'Video ID is required for episode assignment',
              });
            }

            const video = videoMap.get(request.video.id);

            if (!video) {
              throw new BadRequestException({
                code: ERROR_CODE.INVALID_BODY,
                message: 'Video không tồn tại hoặc không hợp lệ',
              });
            }

            await this.videoService.assignVideos(
              [video],
              request.episode.id,
              VideoOwnerType.EPISODE,
            );
          }
        }
      }

      await queryRunner.commitTransaction();

      return await this.findOne(tvSeries.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cập nhật
   */
  async update(id: string, dto: UpdateTVSeriesDto) {
    const queryRunner =
      this.tvSeriesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { seasons, metaData } = dto;
      const tvSeries = await this.findOne(id);

      // Update metadata
      if (metaData) {
        await this.contentService.update(metaData.id, metaData);
      }

      // Handle seasons
      if (seasons && seasons.length > 0) {
        const existingSeasonIds = tvSeries.seasons?.map((s) => s.id) ?? [];
        const requestSeasonIds = seasons.filter((s) => s.id).map((s) => s.id);

        // --- Unlink videos of episodes in deleted seasons ---
        const toDeleteSeasonIds = existingSeasonIds.filter(
          (id) => !requestSeasonIds.includes(id),
        );
        if (toDeleteSeasonIds.length) {
          const episodesToDelete = await this.episodeRepository.find({
            where: { season: { id: In(toDeleteSeasonIds) } },
          });

          const episodeIds = episodesToDelete.map((ep) => ep.id);
          if (episodeIds.length) {
            await this.videoService.unassignVideosByEpisodeIds(episodeIds);
          }

          await queryRunner.manager.delete(
            this.episodeRepository.target,
            episodeIds,
          );
          await queryRunner.manager.delete(
            this.seasonRepository.target,
            toDeleteSeasonIds,
          );
        }

        // Loop qua request seasons
        for (const seasonDto of seasons) {
          let seasonEntity;

          if (seasonDto.id) {
            seasonEntity = await this.seasonRepository.findOne({
              where: { id: seasonDto.id },
              relations: ['episodes'],
            });

            if (!seasonEntity) {
              throw new NotFoundException({
                message: `Season not found`,
                code: ERROR_CODE.ENTITY_NOT_FOUND,
              });
            }

            seasonEntity.totalEpisodes = seasonDto.episodes?.length ?? 0;
            await queryRunner.manager.save(seasonEntity);
          } else {
            seasonEntity = this.seasonRepository.create({
              seasonNumber: seasonDto.seasonNumber,
              totalEpisodes: seasonDto.episodes?.length ?? 0,
              tvseries: tvSeries,
            });
            await queryRunner.manager.save(seasonEntity);
          }

          // Handle episodes
          const existingEpisodeIds =
            seasonEntity.episodes?.map((e) => e.id) ?? [];
          const requestEpisodeIds = (seasonDto.episodes ?? [])
            .filter((e) => e.id)
            .map((e) => e.id);

          // Unlink videos of deleted episodes
          const toDeleteEpisodeIds = existingEpisodeIds.filter(
            (id) => !requestEpisodeIds.includes(id),
          );
          if (toDeleteEpisodeIds.length) {
            await this.videoService.unassignVideosByEpisodeIds(
              toDeleteEpisodeIds,
            );
            await queryRunner.manager.delete(
              this.episodeRepository.target,
              toDeleteEpisodeIds,
            );
          }

          for (const epDto of seasonDto.episodes ?? []) {
            if (epDto.id) {
              const existingEpisode = await this.episodeRepository.findOne({
                where: { id: epDto.id },
              });

              if (!existingEpisode) {
                throw new NotFoundException({
                  message: `Episode not found`,
                  code: ERROR_CODE.ENTITY_NOT_FOUND,
                });
              }

              // ✅ Tách video ra khỏi episodeData
              const { video, ...episodeData } = epDto;

              await queryRunner.manager.update(
                this.episodeRepository.target,
                epDto.id,
                {
                  ...episodeData,
                  season: seasonEntity,
                },
              );

              // ✅ Xử lý video (chỉ 1 video)
              if (video) {
                // Unlink video cũ trước
                await this.videoService.unassignVideosByEpisodeIds([epDto.id]);

                // Validate và assign video mới
                const validVideos = await this.videoService.validateVideos([
                  video,
                ]);
                if (!validVideos.length) {
                  throw new BadRequestException({
                    code: ERROR_CODE.INVALID_BODY,
                    message: 'Video không tồn tại hoặc không hợp lệ',
                  });
                }

                await this.videoService.assignVideos(
                  validVideos,
                  epDto.id,
                  VideoOwnerType.EPISODE,
                );
              } else {
                // Nếu không có video trong request, unlink video hiện tại
                await this.videoService.unassignVideosByEpisodeIds([epDto.id]);
              }
            } else {
              // Tạo episode mới
              const { video, ...episodeData } = epDto;

              const newEp = this.episodeRepository.create({
                ...episodeData,
                season: seasonEntity,
              });
              const savedEp = await queryRunner.manager.save(newEp);

              // ✅ Assign video nếu có
              if (video) {
                const validVideos = await this.videoService.validateVideos([
                  video,
                ]);
                if (!validVideos.length) {
                  throw new BadRequestException({
                    code: ERROR_CODE.INVALID_BODY,
                    message: 'Video không tồn tại hoặc không hợp lệ',
                  });
                }

                await this.videoService.assignVideos(
                  validVideos,
                  savedEp.id,
                  VideoOwnerType.EPISODE,
                );
              }
            }
          }
        }
      } else {
        // Nếu seasons gửi về là rỗng, xoá hết seasons cũ
        const existingSeasons = await this.seasonRepository.find({
          where: { tvseries: { id } },
        });
        const existingSeasonIds = existingSeasons.map((s) => s.id);
        const episodesToDelete = await this.episodeRepository.find({
          where: { season: { id: In(existingSeasonIds) } },
        });

        if (existingSeasonIds.length) {
          await this.videoService.unassignVideosByEpisodeIds(
            episodesToDelete.map((e) => e.id),
          );
        }
        await queryRunner.manager.delete(this.episodeRepository.target, {
          id: In(episodesToDelete.map((e) => e.id)),
        });
        await queryRunner.manager.delete(
          this.seasonRepository.target,
          existingSeasonIds,
        );
      }

      await queryRunner.commitTransaction();

      const [resultWithVideos] = await this._attachVideosToEpisodes([
        await this.findOne(id),
      ]);
      return resultWithVideos;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Xoá
   */
  async delete(id: string) {
    const queryRunner =
      this.tvSeriesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tvSeries = await queryRunner.manager.findOne(EntityTVSeries, {
        where: { id },
        relations: ['metaData'],
      });

      if (!tvSeries) {
        throw new BadRequestException('TV series not found');
      }

      // ✅ Lấy toàn bộ episodeIds của TVSeries để xóa video tương ứng
      const episodes = await queryRunner.manager.find(EntityEpisode, {
        where: { season: { tvseries: { id } } },
        select: ['id'],
      });
      const episodeIds = episodes.map((e) => e.id);

      if (episodeIds.length) {
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(EntityVideo)
          .where('ownerType = :type', { type: VideoOwnerType.EPISODE })
          .andWhere('ownerId IN (:...ids)', { ids: episodeIds })
          .execute();
      }

      // Xoá content liên quan
      if (tvSeries.metaData) {
        await this.contentService.delete(tvSeries.metaData.id);
      }

      await queryRunner.manager.remove(tvSeries);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findByContentId(contentId: string): Promise<EntityTVSeries> {
    const tvSeries = await this.tvSeriesRepository.findOne({
      where: { metaData: { id: contentId } },
      relations: ['metaData'],
    });
    if (!tvSeries) {
      throw new NotFoundException({
        message: `TV series with content ID ${contentId} not found`,
        code: ERROR_CODE.ENTITY_NOT_FOUND,
      });
    }
    return tvSeries;
  }
}
