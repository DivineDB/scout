-- ============================================================
-- Scout — Migration: Outreach Cache Columns
-- Mission: Multi-Channel Hook + Shield Objection System
-- Run in Supabase SQL Editor (service role or owner)
-- ============================================================

-- 1. Add outreach_hooks JSONB column
--    Stores { email: null, linkedin: null, twitter: null }
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS outreach_hooks JSONB DEFAULT '{"email": null, "linkedin": null, "twitter": null}'::jsonb;

-- 2. Add objection_strategies JSONB column
--    Stores AI-generated anti-gatekeeper objection handling lines (array of strings)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS objection_strategies JSONB DEFAULT '[]'::jsonb;

-- 3. Partial index — quickly find rows that still need hook generation
CREATE INDEX IF NOT EXISTS idx_jobs_hooks_missing
  ON jobs ((outreach_hooks IS NULL OR outreach_hooks = '{}'::jsonb))
  WHERE (outreach_hooks IS NULL OR outreach_hooks = '{}'::jsonb);

-- 4. Verify new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('outreach_hooks', 'objection_strategies')
ORDER BY column_name;
