-- docs/schema.sql
-- Run this in your Supabase SQL Editor

CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company JSONB NOT NULL,
  
  role TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  job_type TEXT NOT NULL,
  pay JSONB NOT NULL,
  remote_status TEXT NOT NULL,
  location TEXT NOT NULL,
  
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  match_score INTEGER NOT NULL,
  match_explanation TEXT,
  missing_skills TEXT[] DEFAULT '{}',
  description TEXT NOT NULL,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  requirements TEXT[] NOT NULL DEFAULT '{}',
  
  -- AI Outreach
  hook TEXT,

  apply_url TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  apply_by TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'casual',
  -- 'stale' means profile changed and match_score needs re-validation
  match_stale BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Profile table ───────────────────────────────────────────────────────
-- Stores editable profile overrides (city, salary, skills).
-- Falls back to me.json if no row exists.
CREATE TABLE user_profile (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Single-row pattern: use a fixed key
  profile_key TEXT NOT NULL UNIQUE DEFAULT 'main',

  -- Overrideable fields
  city TEXT,
  state TEXT,
  salary_min INTEGER,
  salary_ideal INTEGER,

  -- Skills stored as JSONB map matching me.json structure
  skills JSONB,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: In a real app we'd add row-level security (RLS).
-- For this prototype pipeline, we'll keep it simple.
