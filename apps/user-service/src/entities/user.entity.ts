import { Column, Entity, OneToMany, Unique } from 'typeorm';

import { USER_STATUS } from '@app/common/enums/global.enum';

import { PersonEntity } from './person.entity';

@Entity({
  name: 'user',
})
@Unique(['providerId'])
export class EntityUser extends PersonEntity {
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @Column({ type: 'enum', enum: USER_STATUS, default: USER_STATUS.ACTIVATED })
  status: USER_STATUS;

  @Column({ type: 'varchar', length: 500, nullable: true })
  banReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  bannedUntil: Date | null;

  @Column({ type: 'boolean', default: false })
  isBanned: boolean;

  // @OneToMany(() => EntityReview, review => review.user)
  // reviews: EntityReview[];

  // @OneToMany(() => EntityReviewEpisode, reviewEpisode => reviewEpisode.user)
  // reviewEpisodes: EntityReviewEpisode[];

  // @OneToMany(() => EntityWatchList, watchlist => watchlist.user)
  // watchlist: EntityWatchList[];

  // @OneToMany(() => EntityFavorite, favorite => favorite.user)
  // favorites: EntityFavorite[];

  // @OneToMany(() => EntityWatchProgress, watchProgress => watchProgress.user)
  // watchProgress: EntityWatchProgress[];

  // @OneToMany(() => EntityNews, news => news.author)
  // news: EntityNews[];
}
