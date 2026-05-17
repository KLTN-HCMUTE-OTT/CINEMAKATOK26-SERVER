import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add performance indexes for the payment subsystem.
 *
 * All indexes use CONCURRENTLY so they don't lock the table during creation.
 * The migration runner must NOT be inside a transaction for CONCURRENTLY to work.
 * TypeORM's MigrationInterface uses runMigrations() which disables transactions
 * per-migration when transaction: false is set in the DataSource options.
 *
 * Indexes added:
 *  - idx_payment_user_date          — user history queries (userId + createdAt DESC)
 *  - idx_payment_order_code         — UNIQUE for VNPAY callback lookup
 *  - idx_payment_status_pending     — partial index for timeout cron job
 *  - idx_payment_saga               — saga monitoring queries
 *  - idx_sub_user_active            — entitlement check (active subscriptions)
 *  - idx_saga_log_saga_id           — saga event log queries
 *  - idx_outbox_pending             — OutboxRelayService polling (unpublished events)
 */
export class AddPaymentIndexes1716000000000 implements MigrationInterface {
  name = 'AddPaymentIndexes1716000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── payment table ───────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_user_date
        ON payment (user_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_order_code
        ON payment (order_code)
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_status_pending
        ON payment (status)
        WHERE status = 'pending'
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_saga
        ON payment (saga_id)
    `);

    // ── subscription table ──────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sub_user_active
        ON subscription (user_id, status, expires_at DESC)
        WHERE status = 'active' AND deleted_at IS NULL
    `);

    // ── saga_event_log table ────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saga_log_saga_id
        ON saga_event_log (saga_id, created_at ASC)
    `);

    // ── outbox_event table ──────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbox_pending
        ON outbox_event (created_at ASC)
        WHERE published = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_outbox_pending`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_saga_log_saga_id`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_sub_user_active`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_payment_saga`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_payment_status_pending`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_payment_order_code`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_payment_user_date`,
    );
  }
}
