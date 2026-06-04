# 👻 Scout — AI-Powered Job Intelligence Platform

> Cut through the noise. Distill the signal. Land the role.

Scout is an AI-powered job intelligence platform designed to cut through the noise of the job hunt. 

Most job boards force you to manually parse through poorly formatted data and irrelevant listings just to find basic salary or visa requirements. Scout is a self-hosted command center that automates the entire research phase—from finding roles and scoring them to generating personalized outreach and custom resumes—so you can spend your time actually applying.

---

## 🚀 How It Works

Scout acts as your personal, autonomous recruiting agent working in the background:

1. **Autonomous Scouting:** The "Ghost Sweep" engine runs automatically on a schedule, hunting for jobs across Google, RemoteOK, Remotive, and specific ATS boards (like Lever, Greenhouse, and Ashby) based on your exact profile preferences.
2. **AI Filtering & Scoring:** Every job goes through a two-stage AI pipeline powered by Groq. It first rapidly filters out bad matches (like roles that don't meet your salary or visa requirements), and then deeply analyzes the good ones, giving them a 0–100 match score.
3. **Instant Preparation:** For every qualified job, Scout automatically generates tailored outreach messages (for Email, LinkedIn, and Twitter) and provides a list of your skill gaps so you know exactly how to prep for an interview.

---

## ✨ Key Features

- **Dual-Pipeline Dashboard:** Keep things organized with a "Casual Hunt" lane for reviewing auto-discovered jobs, and a "Serious Mode" lane for high-intent applications.
- **On-Demand URL Scouting:** Found a job manually? Just paste the URL. Scout scrapes the page using Firecrawl and runs its full AI analysis instantly.
- **Sniper Resume Morpher:** Scout generates an ATS-friendly PDF resume on demand, automatically re-ordering your experience bullet points to highlight the exact tech stack the job requires using `@react-pdf/renderer`.
- **Shield (Gap Analysis):** If a job match is below 70%, Scout highlights specific skill gaps and prepares objection-handling strategies for you.
- **Realtime Staging Queue:** Incoming jobs from Ghost Sweeps are buffered via Supabase Realtime and displayed in a premium floating notification pill, preventing jarring grid updates and visual layout shifts until you click to merge.
- **Zero-Friction Design:** Built with a custom "Obsidian Mint" dark mode, the interface provides real-time, optimistic updates so everything feels instant, ultra-responsive, and uncluttered.

---

## 🛠️ Under the Hood

Scout is engineered for blistering speed and minimal cognitive load:

- **Frontend & Framework:** Next.js 16 (App Router, Server Components), React 19, and Tailwind CSS.
- **Backend & Database:** Supabase (PostgreSQL + Realtime subscriptions).
- **AI Logic:** Groq Cloud Inference (`llama-3.3-70b-versatile` for deep distillation and `llama-3.1-8b-instant` for rapid classification).
- **Data Ingestion:** Firecrawl v4 and Serper.dev.
- **Outreach & Alerts:** Resend (HTML email notifications for high-match "Unicorn" roles).

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
Create a `.env.local` file at the project root:
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
Apply the migration files in `supabase/` to your Supabase project to provision the `jobs`, `user_profile`, and `ghost_sweeps` tables with the correct schema and RLS configurations.

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

<p align="center">Built by <a href="https://github.com/DivineDB">Divyansh Baghel</a></p>
