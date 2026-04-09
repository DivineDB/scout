# 🎯 Scout

**Scout** is a high-speed, AI-powered job hunter designed to cut through the noise, distill signal, and target high-pay remote roles seamlessly.

Built as a personal command center for tech job discovery and application tailoring, Scout automates the boring parts of job hunting. It scores job posts against a central user profile, highlights gaps, generates outreach hooks, and dynamically molds a custom PDF resume to surface the exact keywords the job requires.

![Scout Banner](https://placehold.co/1200x400/050505/00FFC2?text=Scout+Job+Hunter&font=Inter)

## ✨ Features

- 🌒 **Obsidian Mint UI**: A gorgeous, ultra-high-contrast interface (`#050505` background, `#121212` cards, `#00FFC2` carbon mint accents). Built for dark-mode loyalists.
- 🤖 **AI Gap Analysis & Match Scoring**: Uses Gemini 1.5 Flash to distill job URLs, analyze skill alignment against a persistent User Profile, and generate a 0-100% Match Score. If the score is `< 70%`, Scout explicitly surfaces capability gaps.
- 🎣 **Immediate Outreach Hooks**: Auto-generates heavily customized "Quick Intro" blurbs to send on LinkedIn or email. The hooks are persisted in a Supabase backend to prevent duplicate generation.
- 📄 **Sniper Resume Morpher**: Using `@react-pdf/renderer`, Scout instantly morphs a base resume to match the current role, re-ordering experience bullet points based on the job's core tech stack, outputting a highly ATS-friendly PDF.
- 👤 **State-Managed Profile Command Center**: An interactive UI for updating desired salary, location, and technical skills. Updates are synced to the database instantly and trigger a re-validation flag on existing saved jobs.
- ⚡ **Calm Tech Workflow**: Broken down into two pipelines:
  - **Casual Hunt**: Fast ingestion. Drop a URL, let AI distill it.
  - **Serious Mode**: The high-priority pipeline for applying with tailored PDFs and outreach hooks.

## 🛠️ Architecture & Stack

- **Framework**: Next.js 15 (App Router, Server Actions)
- **Database / Auth**: Supabase (PostgreSQL, fully typed)
- **AI / LLM**: Google Gemini 1.5 Flash API
- **Web Scraping**: Firecrawl v4
- **PDF Generation**: `@react-pdf/renderer`
- **Styling**: Tailwind CSS v4, custom CSS variables, Shadcn UI, Sonner (Toasts)
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account & project
- Gemini Platform API Key
- Firecrawl API Key

### 1. Clone & Install
```bash
git clone https://github.com/DivineDB/scout.git
cd scout
npm install
```

### 2. Environment Setup
Create a `.env.local` file at the root of the project with the following:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GEMINI_API_KEY=your_gemini_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

### 3. Database Schema
Ensure your Supabase project contains the `jobs` and `user_profile` tables. (See `supabase/debug_rls_audit.sql` for schema references and RLS configurations). 

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view Scout in your browser.

## 📡 Automation Roadmap
- **Mission 7 (Next)**: *The Ghost Scouter*. Implementation of automated background cron jobs that scrape, score, and notify you of high-match roles while you sleep.

## 📝 License
This is a personal open-source project. Feel free to fork and adapt for your own job hunt!
