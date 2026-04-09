-- ============================================================
-- Scout Schema Fix — user_profile Patch
-- Run this in your Supabase SQL Editor to unblock Profile Saves.
-- ============================================================

-- 1. Safely add missing columns to user_profile
ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS salary_min INT,
ADD COLUMN IF NOT EXISTS salary_ideal INT,
ADD COLUMN IF NOT EXISTS skills JSONB;

-- 2. Force Supabase PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';

-- 3. (Optional) You can check the structure now:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profile';
