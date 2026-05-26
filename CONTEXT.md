# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Mission 8.0 — Design System Hardening — IN PROGRESS.
- **Features Implemented**:
  - **Mission 8.0: Obsidian Mint Design System v1.0**: Removed all light mode infrastructure. Collapsed dual `:root` / `.dark` CSS into a single permanent dark `:root`. Added `--surface-4`, `--mint-strong`, `--border-focus`, `--text-4`, `--status-*` tokens, and utility classes `.surface-*`, `.ring-mint`. ThemeProvider locked via `forcedTheme="dark"`. `<html>` has hardcoded `class="dark"` + `colorScheme: "dark"`. Theme toggle button removed from Sidebar.
  - **Mission 7.6: Groq Migration & Zero-Lag UI**: Migrated AI engine from Google Gemini to Groq. Implemented a two-stage background pipeline (llama-3.1-8b for classification, llama-3.3-70b for deep distillation). Persistent `distilled_data` storage in Supabase allows instant, zero-lag UI rendering in `JobInsightSheet.tsx` and Serious Mode.
  - **Mission 7.5: Serper /jobs & ATS Fallback**: Updated Serper.dev integration to strictly use the `/jobs` endpoint. Implemented a robust ATS fallback mechanism using a boolean "dorking" query to target Lever/Greenhouse/Ashby boards directly when the jobs widget fails.
  - **Mission 7 Patch: Ghost Blindness Fix** *(7.04)*: Fixed Serper query logic to avoid double 'engineer' keywords. Relaxed Hard Gate by temporarily disabling salary filters for higher ingestion volume from RemoteOK/Remotive. Added raw response logging for debugging.
  - **Ghost Scouter MVP** *(7.01)*: Built a background worker using Serper.dev, RemoteOK, and Remotive + Groq 8B/70B scoring. Triggers daily via Vercel Cron. Inserts high-match jobs directly into the `casual` queue. Fires 🦄 Unicorn email alerts via Resend for 95%+ matches.
  - **FilterBar & Ghost Status** *(7.0)*: Added a persistent, dynamic FilterBar in Casual Browse that syncs targeted roles, location, and salary to Supabase. Added Real-time Ghost 👻 indicator in Sidebar with hover stats.
  - **Experience Details Persistence** *(6.18)*: Added `experience_details` column to `user_profile` table and integrated it into the Resume Command Center for persistent Career Story editing.
  - **Column Fix: `distillation_pending`** *(6.14)*: Identified and repaired the missing `distillation_pending` column in the `jobs` table via MCP, resolving 500 errors in the scouting pipeline.
  - **Stub-First Scouting** *(6.13)*: Rewrote the scouting pipeline to save a "Raw Stub" to Supabase immediately after scraping. This guarantees a native UUID for the job even if AI distillation fails or is delayed.

## Architecture
- **Tech Stack**: Next.js 15, Supabase (service role key), Groq SDK (llama-3.3-70b Distiller, llama-3.1-8b Classifier), Firecrawl v4, @react-pdf/renderer.
- **Design System**: **'Obsidian Mint' v1.0** — single `:root` block, always dark, no light mode.

### Design Token Reference (`globals.css` `:root`)

| Category | Token | Value |
|---|---|---|
| **Surfaces** | `--surface-0` | `#050505` deepest |
| | `--surface-1` | `#0E1117` page bg |
| | `--surface-2` | `#121212` card bg |
| | `--surface-3` | `#1A1A1A` inputs |
| | `--surface-4` | `#222222` hover |
| **Text** | `--text-1` | `#FAFAFA` headings |
| | `--text-2` | `#A1A1AA` body (Zinc-400) |
| | `--text-3` | `#71717A` dimmed (Zinc-500) |
| | `--text-4` | `#3F3F46` disabled |
| **Borders** | `--border-subtle` | `rgba(255,255,255,0.04)` |
| | `--border-default` | `rgba(255,255,255,0.08)` |
| | `--border-strong` | `rgba(255,255,255,0.15)` |
| | `--border-focus` | `rgba(0,255,194,0.50)` |
| **Mint** | `--mint` | `#00FFC2` |
| | `--mint-dim` | `rgba(0,255,194,0.12)` |
| | `--mint-strong` | `rgba(0,255,194,0.25)` |
| | `--mint-nav-glow` | glow box-shadow |
| **Scores** | `--score-excellent` | `#00FFC2` 90+ |
| | `--score-good` | `#3B82F6` 70+ |
| | `--score-fair` | `#F59E0B` 50+ |
| | `--score-low` | `#EF4444` <50 |
| **Status** | `--status-remote` | `#34D399` |
| | `--status-hybrid` | `#60A5FA` |
| | `--status-onsite` | `#FBBF24` |

### Utility Classes
- `.glass` — sidebar/floating panels (dark blur bg)
- `.glass-card` — inline card overlay
- `.glass-dark` — deepest floating element
- `.obsidian-card` — primary card primitive
- `.score-badge` — tabular-num score display
- `.surface-{0-3}` — background surface helpers
- `.ring-mint` — mint glow box-shadow on interactive elements
- `.text-mint`, `.bg-mint`, `.bg-mint-dim` — mint color helpers
- `.border-subtle`, `.border-strong` — border helpers

### Theme Enforcement
- `<html class="dark">` hardcoded in `layout.tsx`
- `ThemeProvider forcedTheme="dark" enableSystem={false}` — user cannot toggle
- `color-scheme: dark` on `<html>` — native browser dark styling
- `sonner.tsx` hardcoded to `theme="dark"` — no `useTheme` dependency

## API Routes (All Verified ✅)

| Route | Method | Engine | Purpose |
|---|---|---|---|
| `POST /api/scout` | POST | Groq 70B + Firecrawl | Scrape URL → stub save → AI distill → patch |
| `POST /api/scout/distill` | POST | Groq 70B + Firecrawl | Re-distill existing job by ID |
| `POST /api/job/analyze-gaps` | POST | Groq 8B | Gap analysis for <70% matches |
| `POST /api/job/generate-hook` | POST | Groq 8B | Cold outreach hook generator |
| `POST /api/job/update` | POST | Supabase | Generic job field updater |
| `POST /api/job/status` | POST | Supabase | Update `casual`→`serious` status |
| `GET /api/ghost/status` | GET | Supabase | Last sweep heartbeat stats |
| `GET /api/cron/sweep` | GET/POST | Groq + Serper + Resend | Ghost sweep cron (CRON_SECRET protected) |
| `GET /api/profile/update` | GET/POST | Supabase | Read/upsert user profile |

### API Health Notes
- ✅ All routes use **Groq** (`GROQ_API_KEY` set in `.env.local`)
- ✅ **Firecrawl** key set — scraping active
- ✅ **Supabase** service role key set — RLS bypassed on all writes
- ✅ **Serper** key set — Ghost sweep active
- ✅ **Resend** key set — Unicorn email alerts active
- ✅ **CRON_SECRET** set — `/api/cron/sweep` protected
- ⚠️ `GEMINI_API_KEY` still in `.env.local` — unused, safe to remove

## Supabase Schema (Critical Reference)
- **`jobs`** table: `id` (uuid PK), `status` (text: `casual` | `serious`), `match_score`, `match_stale`, `match_explanation`, `source` (ghost/manual), `snippet`, `distillation_pending` (bool), etc.
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
- **Ghost Sweep**: Background cron job to auto-scout.

## Automation Roadmap
- **Active Objective**: Mission 8.0 — Analytics & Real-World Application Orchestration.

## Commands
Run `npm run check-context` to verify agentic memory retention.
