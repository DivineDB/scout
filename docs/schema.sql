-- docs/schema.sql
-- Run this in your Supabase SQL Editor

CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- We'll store the object directly in JSONB, or we can flatten it
  -- Flattening is usually better for strict typing, but JSONB is fine for 'company' and 'pay'
  company JSONB NOT NULL,
  
  role TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  job_type TEXT NOT NULL,
  pay JSONB NOT NULL,
  remote_status TEXT NOT NULL,
  location TEXT NOT NULL,
  
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  match_score INTEGER NOT NULL,
  description TEXT NOT NULL,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  requirements TEXT[] NOT NULL DEFAULT '{}',
  
  apply_url TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  apply_by TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'casual',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: In a real app we'd add row-level security (RLS).
-- For this prototype pipeline, we'll keep it simple.
-- You might want to disable RLS or add a policy allowing your service key to insert.
