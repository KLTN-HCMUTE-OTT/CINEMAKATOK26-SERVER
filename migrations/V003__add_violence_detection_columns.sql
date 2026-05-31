-- ============================================================
-- 🟧 DATABASE: content_service_db
-- ============================================================
\c content_service_db;

-- Migration: Add violence detection columns to video table
ALTER TABLE "video" 
  ADD COLUMN "isViolent" BOOLEAN DEFAULT NULL,
  ADD COLUMN "violenceScore" DECIMAL(5,4) DEFAULT NULL,
  ADD COLUMN "violentSegments" JSONB DEFAULT NULL;

-- ============================================================
-- 👤 DATABASE: user_service_db
-- ============================================================
\c user_service_db;

-- Migration: Add extensible content preferences to user table (JSONB)
ALTER TABLE "user"
  ADD COLUMN "contentPreferences" JSONB NOT NULL DEFAULT '{"violence": "strict"}'::jsonb;

