# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Mission 6.13 — Emergency Model & ID Sync — COMPLETE.
- **Features Implemented**: 
  - **Gemini 1.5 Flash Latest Swap** *(6.13)*: Standardsized on `gemini-1.5-flash-latest` across all pipelines to resolve model name resolution errors and optimize for low-latency v1beta calls.
  - **Stub-First Scouting** *(6.13)*: Rewrote the scouting pipeline to save a "Raw Stub" to Supabase immediately after scraping. This guarantees a native UUID for the job even if AI distillation fails or is delayed.
  - **Match Validation Softening** *(6.13)*: Changed `match_explanation` from a hard validation throw to a soft fallback fill, preventing AI extraction errors from crashing the entire save pipeline.
  - **Technical Error Surfacing** *(6.13)*: Updated the promotion UI to show real technical errors `[Status: 404]` instead of vague legacy messages when rows are missing.
  - **Gemini 1.5 Pro Model Swap** *(6.12)*: Globally upgraded from `gemini-3.0-flash` to `gemini-1.5-pro` (and later refined in 6.13).

## Architecture
- **Tech Stack**: Next.js 15, Supabase (with service role key for API routes), Gemini 1.5 Flash Latest, Firecrawl v4, @react-pdf/renderer.
- **Design System**: 'Obsidian Mint' — **always dark-first**.
  - **Palette**: Deep Black (`#050505`) / Cards (`#121212`) / Borders (`rgba(255,255,255,0.08)`).
  - **Typography**: Headers in Pure White (`#FAFAFA`), Body in Zinc-400 (`#A1A1AA`).
  - **Accents**: Carbon Mint (`#00FFC2`) for scores, actions, active nav.
  - **Interaction**: Glowing active Nav icons (`--mint-nav-glow`), `z-[9999]` popovers.
  - **Theme enforcement**: `<html class="dark">` hardcoded in `layout.tsx`; `ThemeProvider defaultTheme="dark" enableSystem={false}`.

## Supabase Schema (Critical Reference)
- **`jobs`** table: `id` (uuid PK), `status` (text: `casual` | `serious`), `match_score`, `match_stale`, `match_explanation`, `generated_hook`, etc.
- **`user_profile`** table: `id` (uuid PK), `profile_key` (text, unique, default `'main'`), `city`, `state`, `salary_min`, `salary_ideal`, `skills` (jsonb), `updated_at`.
- **RLS Status**: Use service role key in API routes to bypass RLS. For dev debugging, run the provided SQL to disable RLS entirely.

## Persona Ref
All "Match" and "Morph" logic must strictly anchor to `user_profile` in Supabase (falling back to `src/data/me.json`).
Current Snapshot:
- Name: Divyansh Baghel
- B.Tech CS 2025 (Gwalior, India)
- Full-stack context combined with a filmmaker/photography eye for UX.
- Prefers Remote/Hybrid at ₹8-14 LPA.

## Naming Conventions
- **Serious Mode**: Hard-enforced terminology for the high-priority job pipeline. (Do not use legacy term "Sniper Mode").
- **Scouting**: The act of adding a job from a URL via `/api/scout`.
- **Promoting**: Moving a job from `casual` → `serious` via `JobInsightSheet`.

## Automation Roadmap
- **Next High-Priority Objective**: Mission 7: The Ghost Scouter (automated background scouting + alerts).

## Commands
Run `npm run check-context` to verify agentic memory retention.
