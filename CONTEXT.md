# Project Goal
**Scout** - A high-speed job hunter for Divyansh (2025 CS Grad).
Designed to cut through the noise, distil signal, and target high-pay remote roles seamlessly.

## Current Progress & Status
- **Status**: Deployed on Vercel with Supabase RLS policies active. System Polished.
- **Features Implemented**: Obsidian Dark Mode layout bugfixes, relaxed 2-3 sentence AI hook prompt rules, unconditionally visible ⓘ match explanation popovers, Sidebar UI cleanup, Serious Queue, Split-Pane Workspace, and BAML-style extraction.

## Architecture
- **Tech Stack**: Next.js 15, Supabase, Gemini 1.5 Flash, Firecrawl v4, and @react-pdf/renderer.
- **Design System**: 'Calm Tech'
  - **Palette**: Neutrals (Slate/Zinc) on Obsidian Dark Mode (`#0A0A0A`) / Light Mode (`#FBFBFB`). NO PURPLE.
  - **Accents**: Carbon Mint (`#00FFC2`) heavily used for match scores, badges, and primary actions.
  - **Borders**: Crisp 1px slate borders across all dynamic surfaces and glass-panels.

## Persona Ref
All "Match" and "Morph" logic must strictly anchor to `src/data/me.json`.
Current Snapshot:
- Name: Divyansh
- B.Tech CS 2025 (Gwalior, India)
- Full-stack context combined with a filmmaker/photography eye for UX.
- Prefers Remote/Hybrid at ₹8-14 LPA.

## Naming Conventions
- **Serious Mode**: Hard-enforced terminology for the high-priority job pipeline. (Do not use legacy term "Sniper Mode").

## Automation Roadmap
- **Next High-Priority Objective**: Mission 7: The Ghost Scouter.

## Commands
Run `npm run check-context` to verify agentic memory retention.
