# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Mission 8.5 — Realtime Staging Queue — COMPLETED
- **Features Implemented**:
  - **Mission 8.5: Realtime Staging Queue**: Upgraded the Supabase Realtime subscription in `JobGrid.tsx` to utilize a Staging Queue pattern. Prevents jarring layout shifts by holding new live inserts in a `stagedJobs` state. Realtime inserts trigger a premium, glow-shadowed floating pill at `fixed top-24` notifying the user. When clicked, it seamlessly merges the staged jobs, scrolls to the top with a smooth animation, and executes a high-end card highlight flash.
  - **Mission 8.4: Premium Floating Action Bar**: Refactored the footer actions inside `JobInsightSheet.tsx` into a sticky, premium bottom floating action bar. Hand-crafted with blurred glass (`bg-[var(--surface-1)]/90 backdrop-blur-md`), subtle top border, quiet secondary actions (Trash + Refresh icons on the left), and high-intent, glow-shadowed primary CTAs (Promote with Lucide `Target` + Copy ghost button on the right). Removed legacy body escape hatch.
  - **Mission 8.4: Terminal Stability & Bug Fixes**: Resolved Next.js hydration error in `FilterBar.tsx` caused by nested buttons inside Radix `<PopoverTrigger>` by enabling `asChild`. Fixed a strict React Hook order violation in `JobInsightSheet.tsx` by moving the early return (`if (!job) return null;`) to the end of the component and implementing safe optional chaining across all state hooks and callbacks. Fixed a PGRST204 database schema error during fallback upsert in `ghost.ts` by removing invalid fields (like `name` and other hallucinated columns) and enforcing static typing with a strict local `UserProfile` interface to catch future schema mismatches.
  - **Mission 8.4: Multi-Channel Outreach & Dynamic Search**: Overhauled `JobInsightSheet` with multi-channel outreach hooks (Email, LinkedIn, Twitter) and a "Shield: Objection Handling" accordion for anti-gatekeeper strategies. Added `POST /api/scout/search` for on-demand dynamic job search (bypassing user profile). Updated `POST /api/job/generate-hook` and `POST /api/job/analyze-gaps` to cache results to Supabase (`outreach_hooks` JSONB and `objection_strategies` TEXT[]). Made Cron Sweep (`ghost.ts`) dynamically driven by the Supabase `user_profile` table (salary floor and location).
  - **Mission 8.3: Dead Code & Dependency Audit**: Swept workspace for unused elements. Identified 2 dead React components (`DynamicSearch.tsx` and `ui/drawer.tsx`), dead dependencies (`vaul` is technically dead since only `drawer.tsx` uses it), and remaining Gemini code comments to be cleaned.
  - **Mission 8.2: Instant Optimistic UI & Cache Invalidation**: Overhauled `FilterBar.tsx` using a high-performance optimistic state machine with a `useRef` 600ms debounce. Toggles and sliders feel instant. Added `revalidatePath('/dashboard/casual')` to the profile update API so Next.js server components reflect changes immediately without browser refreshes.
  - **Mission 8.1: Serious Queue Control & Trigger**: Added "Clear Queue" (with 3s confirm-to-click safety) and "Ghost Scout" manual trigger buttons directly to the Serious Queue page header, backed by `/api/job/clear-serious` (DELETE) and `/api/ghost/trigger` (POST) API endpoints.
  - **Mission 8.0: Obsidian Mint Design System v1.0**: Removed all light mode infrastructure. Collapsed dual `:root` / `.dark` CSS into a single permanent dark `:root`. Added `--surface-4`, `--mint-strong`, `--border-focus`, `--text-4`, `--status-*` tokens, and utility classes `.surface-*`, `.ring-mint`. ThemeProvider locked via `forcedTheme="dark"`. `<html>` has hardcoded `class="dark"` + `colorScheme: "dark"`. Theme toggle button removed from Sidebar.

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
| `POST /api/scout/search` | POST | Serper | On-demand dynamic job search (bypasses profile) |
| `POST /api/job/analyze-gaps` | POST | Groq 8B | Gap analysis for <70% matches |
| `POST /api/job/generate-hook` | POST | Groq 8B | Cold outreach hook generator |
| `POST /api/job/update` | POST | Supabase | Generic job field updater |
| `POST /api/job/status` | POST | Supabase | Update `casual`→`serious` status |
| `DELETE /api/job/clear-serious` | DELETE | Supabase | Deletes all "serious" status jobs from Supabase |
| `POST /api/ghost/trigger` | POST | Groq + Serper + Resend | Fire-and-forget manual ghost scout sweep trigger |
| `GET /api/ghost/status` | GET | Supabase | Last sweep heartbeat stats |
| `GET /api/cron/sweep` | GET/POST | Groq + Serper + Resend | Ghost sweep cron (CRON_SECRET protected) |
| `GET/POST /api/profile/update` | GET/POST | Supabase | Read/upsert user profile with optimistic revalidation |

### API Health Notes
- ✅ All routes use **Groq** (`GROQ_API_KEY` set in `.env.local`)
- ✅ **Firecrawl** key set — scraping active
- ✅ **Supabase** service role key set — RLS bypassed on all writes
- ✅ **Serper** key set — Ghost sweep active
- ✅ **Resend** key set — Unicorn email alerts active
- ✅ **CRON_SECRET** set — `/api/cron/sweep` protected
- ⚠️ `GEMINI_API_KEY` still in `.env.local` — unused, safe to remove

## Supabase Schema (Critical Reference)
- **`jobs`** table: `id` (uuid PK), `status` (text: `casual` | `serious`), `match_score`, `match_stale`, `match_explanation`, `source` (ghost/manual), `snippet`, `distillation_pending` (bool), `outreach_hooks` (jsonb), `objection_strategies` (text[]), etc.
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
