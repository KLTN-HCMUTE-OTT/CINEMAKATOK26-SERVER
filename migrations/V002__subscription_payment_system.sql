-- ============================================================
-- Migrations for Phase 2 (Separate Databases)
-- Description: Add payment system tables for OTT subscription
-- Environment: DEV (DROP + RECREATE safe)
-- 
-- IMPORTANT: Since each microservice uses a separate database
-- (order-service-db, payment-service-db, content-service-db),
-- you must run each block in its respective database.
-- ============================================================

-- ============================================================
-- ============================================================
-- 🟦 DATABASE: order-service-db
-- ============================================================
-- ============================================================

DO $$ BEGIN
  CREATE TYPE subscription_status_enum AS ENUM ('active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Create subscription_plan + seed
DROP TABLE IF EXISTS subscription_plan CASCADE;
CREATE TABLE subscription_plan (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR     NOT NULL UNIQUE,
  price           BIGINT      NOT NULL,
  duration_days   INT         NOT NULL DEFAULT 30,
  description     VARCHAR     DEFAULT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"     TIMESTAMPTZ DEFAULT NULL
);

INSERT INTO subscription_plan
  (name, price, duration_days, description)
VALUES
  ('basic',   79000,  30, 'Truy cập nội dung cơ bản'),
  ('premium', 149000, 30, 'Truy cập toàn bộ nội dung HD');

-- 2. Enhance subscription
ALTER TABLE subscription
  DROP COLUMN IF EXISTS plan;

DO $$ BEGIN
  ALTER TABLE subscription
    ALTER COLUMN status TYPE subscription_status_enum
    USING status::text::subscription_status_enum;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'status column already correct type, skipping: %', SQLERRM;
END $$;

ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS plan_id        UUID          DEFAULT NULL REFERENCES subscription_plan(id),
  ADD COLUMN IF NOT EXISTS auto_renew     BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_id     VARCHAR       DEFAULT NULL;

DROP INDEX IF EXISTS idx_subscription_user_active;
CREATE INDEX idx_subscription_user_active
  ON subscription ("userId", status, "expiresAt" DESC)
  WHERE status = 'active' AND "deletedAt" IS NULL;

-- 3. Auto-update updatedAt trigger
CREATE OR REPLACE FUNCTION set_updatedAt()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscription_plan_updatedAt ON subscription_plan;
CREATE TRIGGER trg_subscription_plan_updatedAt
  BEFORE UPDATE ON subscription_plan
  FOR EACH ROW EXECUTE FUNCTION set_updatedAt();


-- ============================================================
-- ============================================================
-- 🟩 DATABASE: payment-service-db
-- ============================================================
-- ============================================================

-- 1. Create payment

CREATE INDEX idx_payment_user
  ON payment ("userId", "createdAt" DESC);
CREATE INDEX idx_payment_saga
  ON payment ("sagaId");


CREATE INDEX idx_saga_log_sagaId
  ON saga_event_log ("sagaId", "createdAt");

-- 3. Auto-update updatedAt trigger
CREATE OR REPLACE FUNCTION set_updatedAt()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_updatedAt ON payment;
CREATE TRIGGER trg_payment_updatedAt
  BEFORE UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION set_updatedAt();


-- ============================================================
-- ============================================================
-- 🟧 DATABASE: content-service-db
-- ============================================================
-- ============================================================

DO $$ BEGIN
  CREATE TYPE access_tier_enum AS ENUM ('basic', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Add accessTier to content
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS "accessTier" access_tier_enum NOT NULL DEFAULT 'basic';

CREATE INDEX IF NOT EXISTS idx_content_accessTier
  ON content ("accessTier");
