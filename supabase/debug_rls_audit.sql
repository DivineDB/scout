-- ============================================================
-- Scout RLS & Schema Audit — Mission 6.9.4 Debug Script
-- Run this in your Supabase SQL Editor to unblock development.
-- ============================================================

-- ── 1. Verify Schema ────────────────────────────────────────
-- Check that the 'jobs' table has the required columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('id', 'status')
ORDER BY column_name;

-- Check that the 'user_profile' table has the required columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profile'
  AND column_name IN ('id', 'profile_key', 'city', 'state', 'salary_min', 'salary_ideal', 'skills', 'updated_at')
ORDER BY column_name;

-- ── 2. Disable RLS (for local testing only) ─────────────────
-- WARNING: Re-enable before deploying to production!
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile DISABLE ROW LEVEL SECURITY;

-- ── 3. Verify 'status' column accepts 'casual' and 'serious' ─
-- Optional: spot check existing rows
SELECT id, status FROM jobs LIMIT 5;

-- ── 4. Re-enable RLS when done testing ──────────────────────
-- Uncomment below when ready for production:
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
