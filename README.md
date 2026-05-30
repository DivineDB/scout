# 👻 Scout — AI-Powered Job Intelligence Platform

> Cut through the noise. Distill the signal. Land the role.

**Scout** is a self-hosted, AI-driven job hunting command center built for speed, precision, and zero-noise signal extraction. It automates the entire intelligence layer of the job search — from autonomous sourcing and scoring to multi-channel outreach generation and ATS-optimized resume morphing — so you can spend time applying, not researching.

---

## ✨ Feature Overview

### 🤖 Two-Stage AI Distillation Pipeline
Every job — whether auto-scouted or manually submitted — flows through a two-stage Groq inference pipeline:

- **Stage 1 — Rapid Classifier** (`llama-3.1-8b-instant`): Processes jobs in batches of 15, applying strict rules on salary floor, seniority alignment, location eligibility (blocks US-only/visa-required roles), and role relevance. Soft-fails safely — undisclosed salaries always pass through.
- **Stage 2 — Deep Distiller** (`llama-3.3-70b-versatile`): Generates a full **Scout Report** per qualifying job: a 0–100 match score, one-sentence match logic, skill gap array, three personalized outreach hooks (Kinetic Hook format), and three ATS-optimized resume bullets tailored to the specific JD.

### 👻 Ghost Sweep Engine (Autonomous Background Scouting)
A multi-source job aggregation engine that runs on a `CRON_SECRET`-protected schedule and sweeps for new roles automatically.

**Sources:**
- **Serper.dev / Google Jobs** — Primary source, queried per `preferred_roles × preferred_location` combination from your live profile.
- **ATS Dork Fallback** — If Google Jobs returns no results for a query, Scout automatically falls back to a precision dork search targeting Lever, Greenhouse, and Ashby job boards.
- **RemoteOK** — Scraped directly from the public API, filtered by role keywords.
- **Remotive** — Queried per role with a 50-result cap.

**Sweep Pipeline:**
1. Fetch all sources in parallel with `Promise.allSettled` (graceful partial failures).
2. Cross-source URL deduplication.
3. Age gate — drops listings older than 48 hours.
4. Stage 1 Groq classification (chunked, with TPM cooldown between chunks).
5. Stage 2 deep distillation (capped at 30 distillations per run for API safety).
6. Upsert to Supabase `jobs` table (deduplication via `external_id`).
7. **🦄 Unicorn Alert** — any job scoring ≥90% triggers an on-brand HTML email via Resend instantly.
8. Sweep stats logged to `ghost_sweeps` table.

Additional controls:
- **Manual Trigger**: Fire a sweep on demand from the Command Center dashboard (`POST /api/ghost/trigger`).
- **Queue Flush**: Delete all Serious Mode jobs with a 3-second confirm-to-click safety gate.
- **Sweep Status**: Poll the last sweep heartbeat and stats via `GET /api/ghost/status`.

### 📊 Dual-Pipeline Job Management
Jobs are tracked across two explicit, purpose-built pipelines:

| Pipeline | Intent |
|---|---|
| **Casual Hunt** | Fast ingestion. Low friction, high volume. Ghost auto-populates this lane. |
| **Serious Mode** | High-intent application queue. Reserved for tailored PDFs, outreach, and objection prep. |

Promote a job from Casual → Serious in one click from the Job Insight Sheet. The Casual Hunt view updates instantly via optimistic UI.

### 🔎 On-Demand URL Scouting
Paste any job posting URL into Scout. The pipeline:
1. Scrapes the full page content via **Firecrawl v4**.
2. Saves an immediate stub to Supabase (optimistic insert — the card appears instantly in the UI).
3. Runs the full Stage 2 distillation asynchronously.
4. Patches the Supabase record with the complete Scout Report upon completion.

Re-distillation is supported — trigger a fresh AI pass on any existing job via `POST /api/scout/distill`.

### 📄 Sniper Resume Morpher
Using `@react-pdf/renderer`, Scout generates a role-targeted PDF resume on demand. The morpher re-orders experience bullet points based on the job's core tech stack and requirements, producing a clean, ATS-friendly output without manual editing.

### 🎣 Multi-Channel Outreach Hook Generator
One-click, channel-aware cold outreach copy powered by `llama-3.1-8b-instant`. Each channel has strict formatting constraints enforced at the prompt level:

| Channel | Format |
|---|---|
| **Email** | 3-sentence cold email to a founder. Direct, no filler, no generic openers. |
| **LinkedIn** | 2-sentence connection request (≤250 characters). |
| **Twitter / X** | 1-sentence DM. Casual, punchy, lowercase is acceptable. |

Generated hooks are cached to the `outreach_hooks` JSONB column in Supabase, eliminating redundant API calls on revisit.

### 🛡️ Shield — Gap Analysis & Objection Handling
For any job with a match score below 70%, Scout surfaces 3–5 specific skill gaps and a paired objection-handling strategy for each via `POST /api/job/analyze-gaps`. Results are cached to `objection_strategies` (TEXT[]) in Supabase.

### ⚡ Realtime Staging Queue
Live job inserts from Ghost Sweeps are delivered to the Casual Hunt view via **Supabase Realtime** without any jarring layout shifts:
- New inserts are buffered in a `stagedJobs` state — the grid is not immediately re-rendered.
- A premium floating pill notification appears at `fixed top-24` showing the count of incoming jobs.
- Clicking the pill merges the staged jobs, scrolls to top with a smooth animation, and triggers a per-card highlight flash.

### 👤 Profile Command Center
A fully interactive profile UI backed by the Supabase `user_profile` table. All parameters that drive the Ghost Sweep — salary floor, ideal salary, preferred roles, locations, and skills — are managed here. Updates use an optimistic state machine with a 600ms debounce and trigger `revalidatePath('/dashboard/casual')` server-side so the Next.js cache reflects changes immediately.

### 🎨 Obsidian Mint Design System v1.0
A bespoke, permanently dark design system. Light mode infrastructure has been fully removed.

**Surface Ramp:** `#050505` (deepest) → `#0E1117` (page bg) → `#121212` (cards) → `#1A1A1A` (inputs) → `#222222` (hover)

**Accent:** `#00FFC2` carbon mint — used for CTAs, focus rings, score badges, and nav glows.

**Score Chromatics:**
| Score | Color |
|---|---|
| ≥ 90 | `#00FFC2` Mint (Excellent) |
| ≥ 70 | `#3B82F6` Blue (Good) |
| ≥ 50 | `#F59E0B` Amber (Fair) |
| < 50 | `#EF4444` Red (Low) |

**Utility Primitives:** `.glass`, `.glass-card`, `.glass-dark` (glassmorphism layers), `.obsidian-card`, `.score-badge`, `.ring-mint`, `.surface-{0-3}`.

**Theme Enforcement:** `<html class="dark">` hardcoded in `layout.tsx`. `ThemeProvider` locked to `forcedTheme="dark"`. No toggle exposed to the user.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Components) |
| **Language** | TypeScript 5 |
| **Database / Realtime** | Supabase (PostgreSQL + Realtime subscriptions) |
| **LLM — Distillation** | Groq `llama-3.3-70b-versatile` |
| **LLM — Classification** | Groq `llama-3.1-8b-instant` |
| **Web Scraping** | Firecrawl v4 (`@mendable/firecrawl-js`) |
| **Job Discovery** | Serper.dev (Google Jobs), RemoteOK, Remotive |
| **PDF Generation** | `@react-pdf/renderer` |
| **Email** | Resend |
| **Styling** | Tailwind CSS v4, custom CSS variables, Shadcn UI |
| **Toasts** | Sonner |
| **Icons** | Lucide React |
| **Runtime** | React 19, Node.js 18+ |

---

## 🗺️ API Reference

| Endpoint | Method | Engine | Description |
|---|---|---|---|
| `/api/scout` | `POST` | Groq 70B + Firecrawl | Scrape URL → stub save → AI distill → patch record |
| `/api/scout/distill` | `POST` | Groq 70B + Firecrawl | Re-distill an existing job by ID |
| `/api/scout/search` | `POST` | Serper | On-demand dynamic job search (bypasses profile config) |
| `/api/job/analyze-gaps` | `POST` | Groq 8B | Gap analysis + objection handling strategies |
| `/api/job/generate-hook` | `POST` | Groq 8B | Channel-specific outreach copy generator |
| `/api/job/update` | `POST` | Supabase | Generic job field updater |
| `/api/job/status` | `POST` | Supabase | Promote job: `casual → serious` |
| `/api/job/clear-serious` | `DELETE` | Supabase | Flush the entire Serious Mode queue |
| `/api/ghost/trigger` | `POST` | Groq + Serper + Resend | Fire-and-forget manual Ghost Sweep |
| `/api/ghost/status` | `GET` | Supabase | Last sweep heartbeat, counts, and status |
| `/api/cron/sweep` | `GET/POST` | Groq + Serper + Resend | Scheduled Ghost Sweep (`CRON_SECRET` protected) |
| `/api/profile/update` | `GET/POST` | Supabase | Read / upsert user profile with cache revalidation |

---

## 🗄️ Database Schema (Supabase)

### `jobs`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Auto-generated |
| `status` | `text` | `casual` or `serious` |
| `match_score` | `int` | 0–100 AI match score |
| `match_stale` | `bool` | Flags jobs needing re-distillation after profile update |
| `match_explanation` | `text` | One-sentence AI match rationale |
| `source` | `text` | `ghost` (auto) or `manual` (URL paste) |
| `snippet` | `text` | Raw job description snippet |
| `distillation_pending` | `bool` | True while Stage 2 is in progress |
| `outreach_hooks` | `jsonb` | Cached hooks keyed by channel (`email`, `linkedin`, `twitter`) |
| `objection_strategies` | `text[]` | Cached objection handling strategies |

### `user_profile`
`id` · `profile_key` · `city` · `state` · `salary_min` · `salary_ideal` · `skills` (JSONB) · `experience_details` · `preferred_roles` (TEXT[]) · `preferred_location` (TEXT[]) · `updated_at`

### `ghost_sweeps`
`id` · `ran_at` · `jobs_found` · `jobs_saved` · `high_matches` · `status` · `query_used` · `error_message`

> **Note:** All API routes use the Supabase service role key, bypassing Row Level Security on writes.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase project (PostgreSQL + Realtime enabled)
- API keys: Groq, Firecrawl, Serper.dev, Resend

### 1. Clone & Install
```bash
git clone https://github.com/DivineDB/scout.git
cd scout
npm install
```

### 2. Environment Configuration
Create `.env.local` at the project root:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI — Groq
GROQ_API_KEY=your_groq_api_key

# Web Scraping
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Job Discovery
SERPER_API_KEY=your_serper_api_key

# Email Alerts
RESEND_API_KEY=your_resend_api_key

# Cron Protection
CRON_SECRET=your_long_random_cron_secret
```

### 3. Database Setup
Apply the migration files in `supabase/` to your Supabase project to provision the `jobs`, `user_profile`, and `ghost_sweeps` tables with the correct schema and RLS configuration.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to launch Scout.

### 5. Configure Ghost Sweep (Optional)
Point any cron scheduler (Vercel Cron, GitHub Actions, Upstash, etc.) at `GET /api/cron/sweep` with the header:
```
Authorization: Bearer <CRON_SECRET>
```
Recommended schedule: daily at 09:00 IST.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/sweep/         # Scheduled Ghost Sweep endpoint
│   │   ├── ghost/              # Manual trigger & sweep status
│   │   ├── job/                # Gap analysis, hook gen, status, updates
│   │   ├── profile/            # User profile CRUD
│   │   └── scout/              # URL scouting & re-distillation
│   └── dashboard/
│       ├── casual/             # Casual Hunt job grid
│       ├── serious/            # Serious Mode queue
│       ├── pipeline/           # Full pipeline overview
│       ├── command-center/     # Ghost Sweep control panel & logs
│       └── profile/            # Profile Command Center
├── components/
│   ├── dashboard/              # JobCard, JobGrid, JobInsightSheet
│   ├── FilterBar.tsx           # Optimistic filter controls (600ms debounce)
│   └── ResumeTemplate.tsx      # react-pdf resume renderer
├── lib/
│   └── ghost.ts                # Ghost Sweep Engine (~950 lines)
├── data/
│   └── me.json                 # Persona fallback data
└── types/                      # Fully typed job & persona interfaces
```

---

## 📝 License

Personal open-source project. Fork freely and adapt it for your own job hunt.

---

<p align="center">Built with 👻 by <a href="https://github.com/DivineDB">Divyansh Baghel</a></p>
