# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Mission 6.9 Successfully Executed & Verified.
- **Features Implemented**: 
  - **Obsidian Contrast Overhaul**: Deep black `#050505` background with `#121212` cards and Zinc body text.
  - **Profile Command Center**: Interactive state-managed profile editor (Salary, Location, Tech Stack) with Supabase persistence and match re-validation triggers.
  - **Hook Persistence**: AI-generated outreach hooks are now stored in Supabase and reused.
  - **AI Gap Analysis**: Automated 3+ point gap identification for matches < 70%.
  - **Data Integrity**: Hard validation on match explanations and sidebar top padding fix.

## Architecture
- **Tech Stack**: Next.js 15, Supabase, Gemini 1.5 Flash, Firecrawl v4, and @react-pdf/renderer.
- **Design System**: 'Obsidian Mint'
  - **Palette**: Deep Black (`#050505`) / Light Mode (`#FBFBFB`). Cards utilize `#121212` with subtle borders.
  - **Typography**: Headers in Pure White (`#FAFAFA`), Body in Zinc-400 (`#A1A1AA`).
  - **Accents**: Carbon Mint (`#00FFC2`) heavily used for match scores, buttons, and primary actions.
  - **Interaction**: Glowing active Nav icons and `z-[9999]` popovers.

## Persona Ref
All "Match" and "Morph" logic must strictly anchor to `user_profile` in Supabase (falling back to `src/data/me.json`).
Current Snapshot:
- Name: Divyansh Baghel
- B.Tech CS 2025 (Gwalior, India)
- Full-stack context combined with a filmmaker/photography eye for UX.
- Prefers Remote/Hybrid at ₹8-14 LPA.

## Naming Conventions
- **Serious Mode**: Hard-enforced terminology for the high-priority job pipeline. (Do not use legacy term "Sniper Mode").

## Automation Roadmap
- **Next High-Priority Objective**: Mission 7: The Ghost Scouter.

## Commands
Run `npm run check-context` to verify agentic memory retention.
