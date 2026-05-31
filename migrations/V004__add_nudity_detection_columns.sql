-- ============================================================
-- 🟧 DATABASE: content_service_db
-- ============================================================
\c content_service_db;

-- Migration: Add nudity detection columns to video table
ALTER TABLE "video" 
  ADD COLUMN "isNude" BOOLEAN DEFAULT NULL,
  ADD COLUMN "nudityScore" DECIMAL(5,4) DEFAULT NULL,
  ADD COLUMN "nuditySegments" JSONB DEFAULT NULL;

-- ============================================================
-- 👤 DATABASE: user_service_db
-- ============================================================
\c user_service_db;

-- Migration: Update user table contentPreferences default value to include nudity
ALTER TABLE "user"
  ALTER COLUMN "contentPreferences" SET DEFAULT '{"violence": "strict", "nudity": "strict"}'::jsonb;

-- Update existing user rows to include the nudity preference default
UPDATE "user"
  SET "contentPreferences" = "contentPreferences" || '{"nudity": "strict"}'::jsonb
  WHERE "contentPreferences" IS NOT NULL;

