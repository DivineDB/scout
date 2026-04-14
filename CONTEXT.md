# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Mission 7.6 — The Kinetic Groq Overhaul — COMPLETE.
- **Features Implemented**: 
  - **Mission 7.6: Groq Migration & Zero-Lag UI**: Migrated AI engine from Google Gemini to Groq. Implemented a two-stage background pipeline (llama-3.1-8b for classification, llama-3.3-70b for deep distillation). Persistent `distilled_data` storage in Supabase allows instant, zero-lag UI rendering in `JobInsightSheet.tsx` and Serious Mode. 
  - **Mission 7.5: Serper /jobs & ATS Fallback**: Updated Serper.dev integration to strictly use the `/jobs` endpoint. Implemented a robust ATS fallback mechanism using a boolean "dorking" query to target Lever/Greenhouse/Ashby boards directly when the jobs widget fails.
  - **Mission 7 Patch: Ghost Blindness Fix** *(7.04)*: Fixed Serper query logic to avoid double 'engineer' keywords. Relaxed Hard Gate by temporarily disabling salary filters for higher ingestion volume from RemoteOK/Remotive. Added raw response logging for debugging.
  - **Ghost Scouter MVP** *(7.01)*: Built a background worker using Serper.dev, RemoteOK, and Remotive + Groq 8B/70B scoring. Triggers daily via Vercel Cron. Inserts high-match jobs directly into the `casual` queue. Fires 🦄 Unicorn email alerts via Resend for 95%+ matches.
  - **FilterBar & Ghost Status** *(7.0)*: Added a persistent, dynamic FilterBar in Casual Browse that syncs targeted roles, location, and salary to Supabase. Added Real-time Ghost 👻 indicator in Sidebar with hover stats.
  - **Experience Details Persistence** *(6.18)*: Added `experience_details` column to `user_profile` table and integrated it into the Resume Command Center for persistent Career Story editing.
  - **Career Story Synchronization** *(6.18)*: Established robust real-time synchronization between the Dashboard Profile UI and the server-side Supabase persistence layer.
  - **Column Fix: `distillation_pending`** *(6.14)*: Identified and repaired the missing `distillation_pending` column in the `jobs` table via MCP, resolving 500 errors in the scouting pipeline.
  - **Stub-First Scouting** *(6.13)*: Rewrote the scouting pipeline to save a "Raw Stub" to Supabase immediately after scraping. This guarantees a native UUID for the job even if AI distillation fails or is delayed.
  - **Match Validation Softening** *(6.13)*: Changed `match_explanation` from a hard validation throw to a soft fallback fill, preventing AI extraction errors from crashing the entire save pipeline.
  - **Technical Error Surfacing** *(6.13)*: Updated the promotion UI to show real technical errors `[Status: 404]` instead of legacy messages.
  - **Groq 70B/8B Model Swap**: Globally migrated from `gemini-1.5-pro` and `gemini-2.5-flash` to `llama-3.3-70b-versatile` and `llama-3.1-8b-instant`.

## Architecture
- **Tech Stack**: Next.js 15, Supabase (service role key), Groq SDK (70B Distiller, 8B Classifier), Firecrawl v4, @react-pdf/renderer. Remove: @google/genai.
- **Design System**: 'Obsidian Mint' — **always dark-first**.
  - **Palette**: Deep Black (`#050505`) / Cards (`#121212`) / Borders (`rgba(255,255,255,0.08)`).
  - **Typography**: Headers in Pure White (`#FAFAFA`), Body in Zinc-400 (`#A1A1AA`).
  - **Accents**: Carbon Mint (`#00FFC2`) for scores, actions, active nav.
  - **Interaction**: Glowing active Nav icons (`--mint-nav-glow`), `z-[9999]` popovers.
  - **Theme enforcement**: `<html class="dark">` hardcoded in `layout.tsx`; `ThemeProvider defaultTheme="dark" enableSystem={false}`.

## Supabase Schema (Critical Reference)
- **`jobs`** table: `id` (uuid PK), `status` (text: `casual` | `serious`), `match_score`, `match_stale`, `match_explanation`, `source` (ghost/manual), `snippet`, etc.
- **`user_profile`** table: `id` (uuid PK), `profile_key` (text), `city`, `state`, `salary_min`, `salary_ideal`, `skills` (jsonb), `experience_details` (text), `preferred_roles` (text[]), `preferred_location` (text[]), `updated_at`.
- **`ghost_sweeps`** table: `id` (uuid PK), `ran_at`, `jobs_found`, `jobs_saved`, `high_matches`, `status`, `query_used`.
- **RLS Status**: Use service role key in API routes to bypass RLS.

## Persona Ref
All "Match" and "Morph" logic must strictly anchor to `user_profile` in Supabase (falling back to `src/data/me.json`).
Current Snapshot:
- Name: Divyansh Baghel
- B.Tech CS 2025 (Gwalior, India)
- Full-stack context combined with a filmmaker/photography eye for UX.
- Prefers Remote/Hybrid at ₹12-18 LPA.

## Naming Conventions
- **Serious Mode**: Hard-enforced terminology for the high-priority job pipeline. (Do not use legacy term "Sniper Mode").
- **Scouting**: The act of adding a job from a URL via `/api/scout`.
- **Promoting**: Moving a job from `casual` → `serious` via `JobInsightSheet`.
- **Ghost Sweep**: Background background cron job to auto-scout.

## Automation Roadmap
- **Active Objective**: Mission 8.0: Analytics & Real-World Application Orchestration.

## Commands
Run `npm run check-context` to verify agentic memory retention.
