# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Mission 6.12 — Scout Total Restoration — COMPLETE.
- **Features Implemented**: 
  - **Gemini 1.5 Pro Model Swap** *(6.12)*: Globally upgraded from `gemini-3.0-flash` to `gemini-1.5-pro` across all critical pipelines (Distillation, Hook Generation, Gap Analysis) to bypass rate limits and improve intelligence.
  - **Service Role Persistence Hardening** *(6.12)*: Locked `api/profile/update` and job status updates to use `SUPABASE_SERVICE_ROLE_KEY` exclusively. Removed legacy `profile_key` (non-existent in current schema) to fix silent save failures.
  - **Obsidian Sheet UI Standarization** *(6.12)*: Forced `bg-[#050505]` and `border-white/10` on all slide-over sheets (Profile Hub and Job Insight). Added dedicated "Promoting..." and "Syncing..." loading states with spinners.
  - **UUID Safety Guard** *(6.12)*: Implemented a critical console guard in `JobCard` to flag any job missing a valid database UUID—preventing "Mock" error confusion during promotion.
  - **Auth-Aware Persistence** *(6.11)*: Refactored `api/profile/update` to target `id` PK (linked to `auth.uid()`) using `@supabase/ssr` server-side context.

## Architecture
- **Tech Stack**: Next.js 15, Supabase (with service role key for API routes), Gemini 3.0 Flash, Firecrawl v4, @react-pdf/renderer.
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
