# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Mission 6.9.5 — Final Logic Bridge & Theme Lockdown — Successfully Executed.
- **Features Implemented**: 
  - **Obsidian Contrast Overhaul**: Deep black `#050505` background with `#121212` cards and Zinc body text.
  - **Profile Command Center**: Interactive state-managed profile editor (Salary, Location, Tech Stack) with Supabase persistence and match re-validation triggers.
  - **Hook Persistence**: AI-generated outreach hooks are now stored in Supabase and reused.
  - **AI Gap Analysis**: Automated 3+ point gap identification for matches < 70%.
  - **Data Integrity**: Hard validation on match explanations and sidebar top padding fix.
  - **Profile Persistence Update** *(6.9.5)*: `api/profile/update` uses strict upsert payload injection and returns stringified Supabase errors on failure.
  - **RLS Bypass Architecture** *(6.9.5)*: Client-side writes failed due to Supabase RLS policies. Migrated all Supabase `.update()` calls (Promoting to Serious, Hook Saving) to Server-Side API routes (`/api/job/update`) using `SUPABASE_SERVICE_ROLE_KEY` to permanently bypass auth blocks.
  - **Profile UI Refresh** *(6.9.5)*: Call `router.refresh()` in Profile page component after successfully tracking the API request. 
  - **Status Update Guard** *(6.9.5)*: Ensured all status updates refer strictly to the `id` UUID mapped column via the new `/update` API.
  - **Obsidian Theme Lockdown V2** *(6.9.5)*: Enforced `<html style="background-color: #050505">` and added `forcedTheme="dark"` to `next-themes` to kill local storage light-mode ghosting. Removed lingering `slate-700` colors in `JobInsightSheet`.
  - **Data Hydration** *(6.9.5)*: `serious/[id]/page.tsx` pulls `generated_hook` strictly from DB mapping state to avoid re-generating hooks repeatedly per visit.

## Architecture
- **Tech Stack**: Next.js 15, Supabase (with service role key for API routes), Gemini 1.5 Flash, Firecrawl v4, @react-pdf/renderer.
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
