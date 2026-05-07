import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@app/common/base/base-entity';

/**
 * Stores CENC encryption keys for DRM-protected videos.
 *
 * Each video gets a unique (keyId, contentKey) pair:
 * - keyId:      public identifier embedded in the DASH manifest (<ContentProtection>)
 * - contentKey: secret AES-128 key used to encrypt/decrypt video segments
 *
 * The contentKey is NEVER exposed in manifests or client-side code.
 * It is only returned via the ClearKey license endpoint after entitlement validation.
 */
@Entity({ name: 'drm_key' })
export class EntityDrmKey extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  @Index()
  videoId: string;

  /** Hex-encoded 128-bit Key ID (32 hex chars). Public — appears in .mpd manifest. */
  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  keyId: string;

  /** Hex-encoded 128-bit Content Encryption Key (32 hex chars). SECRET. */
  @Column({ type: 'varchar', length: 32 })
  contentKey: string;
}
