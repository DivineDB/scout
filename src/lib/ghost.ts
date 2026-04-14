/**
 * Ghost Scouter Engine — src/lib/ghost.ts
 * Sources: Serper.dev (Google Jobs) + RemoteOK + Remotive
 * Pipeline: Fetch → Stage1 Groq Classify → Stage2 Groq Distill → Upsert → 🦄 Email Alert
 */
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_DAILY_DISTILLATIONS = 30; // free-tier 70B rate-limit safety cap

// ─── Clients ──────────────────────────────────────────────────────────────────
function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`[Ghost] Missing Supabase config. (Found URL: ${!!url}, Key: ${!!key})`);
  }
  return createClient(url, key);
}

function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('[Ghost] Missing GROQ_API_KEY');
  return new Groq({ apiKey });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawJob {
  external_id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  posted_at: string;
  tags: string[];
  salary_info?: string;
  location: string;
  source: 'serper' | 'remoteok' | 'remotive';
}

interface ScoredJob extends RawJob {
  match_score: number;
  match_logic: string;
}

export interface DistilledData {
  gaps: string[];
  hooks: string[];
  tailored_bullets: string[];
  match_score?: number;
  match_logic?: string;
}

export interface SweepResult {
  jobs_found: number;
  jobs_filtered: number;
  jobs_saved: number;
  top_matches: number;
}

// ─── Role keywords ────────────────────────────────────────────────────────────
const ROLE_KEYWORDS: Record<string, string[]> = {
  'Design Engineer':   ['design engineer', 'product designer', 'ui engineer', 'ux engineer', 'design systems'],
  'Full-stack':        ['full stack', 'fullstack', 'full-stack', 'software engineer', 'software developer'],
  'Frontend':          ['frontend', 'front-end', 'front end', 'react developer', 'next.js'],
  'AI Engineer':       ['ai engineer', 'ml engineer', 'machine learning', 'llm', 'genai'],
};

function matchesRole(title: string, roles: string[]): boolean {
  const lower = title.toLowerCase();
  return roles.some(r => (ROLE_KEYWORDS[r] ?? [r.toLowerCase()]).some(kw => lower.includes(kw)));
}

// ─── Parse "X days ago" → ISO date ───────────────────────────────────────────
function parseRelativeDate(text: string): string {
  const now = Date.now();
  const t = text.toLowerCase();
  if (t.includes('hour'))   return new Date(now - (parseInt(t) || 1) * 3_600_000).toISOString();
  if (t.includes('day'))    return new Date(now - (parseInt(t) || 1) * 86_400_000).toISOString();
  if (t.includes('week'))   return new Date(now - (parseInt(t) || 1) * 604_800_000).toISOString();
  if (t.includes('just') || t.includes('now') || t.includes('today')) return new Date(now).toISOString();
  return new Date().toISOString();
}

// ─── Source 1: Serper.dev — Google Jobs (with ATS fallback) ──────────────────
async function fetchSerper(roles: string[]): Promise<RawJob[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn('[Ghost] SERPER_API_KEY not set — skipping Google Jobs source');
    return [];
  }

  console.log('[Ghost] Fetching from Serper.dev (Google Jobs)...');

  // Query sanitizer — never append 'engineer' if the role already implies it
  const queries = roles.map(role => {
    const lower = role.toLowerCase();
    const hasJobKeyword = lower.includes('engineer') || lower.includes('developer') ||
                          lower.includes('designer') || lower.includes('manager') ||
                          lower.includes('analyst');
    return hasJobKeyword ? `${role} Remote India` : `${role} engineer Remote India`;
  });

  const allJobs: RawJob[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    let jobsFetchedForQuery = false;

    // ── Primary: Strict POST to /jobs
    try {
      const resp = await fetch('https://google.serper.dev/jobs', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q, gl: 'in', hl: 'en' }),
        signal: AbortSignal.timeout(12000),
      });

      if (resp.ok) {
        let data;
        try { data = JSON.parse(await resp.text()); } catch { /* fall through */ }

        if (Array.isArray(data?.jobs) && data.jobs.length > 0) {
          for (const job of data.jobs) {
            const id = `serper-${job.jobId ?? job.title?.slice(0, 20) ?? Math.random()}`;
            if (seen.has(id)) continue;
            seen.add(id);
            allJobs.push({
              external_id: id,
              title: String(job.title ?? ''),
              company: String(job.companyName ?? 'Unknown'),
              description: String(job.description ?? '').substring(0, 600),
              url: String(job.applyLink ?? job.jobHighlightsLink ?? ''),
              posted_at: job.date ? parseRelativeDate(job.date) : new Date().toISOString(),
              tags: Array.isArray(job.extensions) ? job.extensions.slice(0, 8) : [],
              salary_info: job.salary ?? undefined,
              location: String(job.location ?? 'India'),
              source: 'serper',
            });
          }
          jobsFetchedForQuery = true;
          console.log(`[Ghost] /jobs succeeded for: ${q}`);
        }
      } else {
        console.warn(`[Ghost] Serper /jobs returned ${resp.status} for query: ${q} — activating ATS fallback`);
      }
    } catch (err) {
      console.warn(`[Ghost] Serper /jobs request failed for "${q}": ${err}`);
    }

    // ── ATS fallback dork on /search if /jobs failed (any error or non-ok)
    if (!jobsFetchedForQuery) {
      // Strip location modifiers to get clean role name for the dork
      const cleanRole = q.replace(/ Remote India$/, '').replace(/ Remote$/, '').trim();

      // Spec-exact dork format: target premium ATS platforms
      const dorkQuery = `(site:jobs.lever.co OR site:boards.greenhouse.io OR site:jobs.ashbyhq.com) "${cleanRole}" ("Remote India" OR "Anywhere" OR Pune)`;
      console.log(`[Ghost] Serper ATS fallback dork: ${dorkQuery}`);

      try {
        const fallback = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: dorkQuery, gl: 'in', hl: 'en', num: 10 }),
          signal: AbortSignal.timeout(12000),
        });

        if (fallback.ok) {
          let fallbackData;
          try { fallbackData = JSON.parse(await fallback.text()); } catch { /* skip */ }

          const organicResults: Record<string, unknown>[] = Array.isArray(fallbackData?.organic)
            ? fallbackData.organic
            : [];

          for (const result of organicResults) {
            const link = String(result.link ?? '');
            if (!link) continue;
            const id = `serper-dork-${link.slice(-40)}`;
            if (seen.has(id)) continue;
            seen.add(id);

            allJobs.push({
              external_id: id,
              title: String(result.title ?? cleanRole),
              company: String(result.displayedLink ?? result.domain ?? 'Via ATS'),
              description: String(result.snippet ?? '').substring(0, 600),
              url: link,
              posted_at: new Date().toISOString(),
              tags: [cleanRole],
              salary_info: undefined,
              location: 'Remote / Pune',
              source: 'serper',
            });
          }
          console.log(`[Ghost] ATS fallback found ${organicResults.length} results for: ${cleanRole}`);
        } else {
          console.warn(`[Ghost] ATS fallback /search also failed: ${fallback.status}`);
        }
      } catch (err) {
        console.warn(`[Ghost] ATS fallback request failed for "${cleanRole}": ${err}`);
      }
    }

    await new Promise(r => setTimeout(r, 300)); // brief pause between queries
  }

  console.log(`[Ghost] Serper: ${allJobs.length} jobs fetched (primary + ATS fallback)`);
  return allJobs;
}

// ─── Source 2: RemoteOK ───────────────────────────────────────────────────────
async function fetchRemoteOK(roles: string[]): Promise<RawJob[]> {
  console.log('[Ghost] Fetching from RemoteOK...');
  const resp = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'Scout/1.0 Job Hunter' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`RemoteOK: ${resp.status}`);
  const data = await resp.json();
  const listings = Array.isArray(data) ? data.slice(1) : [];

  return listings
    .filter((j: Record<string, unknown>) => matchesRole(String(j.position ?? ''), roles))
    .map((j: Record<string, unknown>) => {
      const id = String(j.id ?? Math.random());
      return {
        external_id: `remoteok-${id}`,
        title: String(j.position ?? ''),
        company: String(j.company ?? 'Unknown'),
        description: String(j.description ?? '').replace(/<[^>]*>/g, '').substring(0, 600),
        url: String(j.url ?? `https://remoteok.com/l/${id}`),
        posted_at: String(j.date ?? new Date().toISOString()),
        tags: (Array.isArray(j.tags) ? j.tags as string[] : []).slice(0, 12),
        salary_info: j.salary_min ? `$${j.salary_min}–$${j.salary_max ?? j.salary_min}` : undefined,
        location: 'Remote',
        source: 'remoteok' as const,
      };
    });
}

// ─── Source 3: Remotive ───────────────────────────────────────────────────────
async function fetchRemotive(roles: string[]): Promise<RawJob[]> {
  console.log('[Ghost] Fetching from Remotive...');
  const results = await Promise.all(
    roles.map(r =>
      fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(r)}&limit=50`, {
        signal: AbortSignal.timeout(15000),
      })
        .then(res => res.json())
        .catch(() => ({ jobs: [] }))
    )
  );

  const seen = new Set<number>();
  const all: RawJob[] = [];

  for (const res of results) {
    for (const j of (res?.jobs ?? []) as Record<string, unknown>[]) {
      const id = Number(j.id ?? 0);
      if (seen.has(id)) continue;
      seen.add(id);
      if (!matchesRole(String(j.title ?? ''), roles)) continue;

      all.push({
        external_id: `remotive-${id}`,
        title: String(j.title ?? ''),
        company: String(j.company_name ?? 'Unknown'),
        description: String(j.description ?? '').replace(/<[^>]*>/g, '').substring(0, 600),
        url: String(j.url ?? ''),
        posted_at: String(j.publication_date ?? new Date().toISOString()),
        tags: (Array.isArray(j.tags) ? j.tags as string[] : []).slice(0, 12),
        salary_info: j.salary ? String(j.salary) : undefined,
        location: String(j.candidate_required_location ?? 'Remote'),
        source: 'remotive',
      });
    }
  }
  return all;
}

// ─── Filter 1: Hard Gate ──────────────────────────────────────────────────────
// Age-only gate — salary check is delegated to Stage 1 Groq classifier
function passesHardGate(job: RawJob): boolean {
  const postedAt = new Date(job.posted_at);
  if (!isNaN(postedAt.getTime())) {
    const hoursOld = (Date.now() - postedAt.getTime()) / 3_600_000;
    if (hoursOld > 48) return false;
  }
  return true;
}

// ─── Stage 1: Rapid Classification (llama-3.1-8b-instant) ────────────────────
// Filters out roles paying below 12L or requiring excessive seniority
async function stage1_classify(
  jobs: RawJob[],
  profileCtx: string,
  groq: Groq
): Promise<string[]> {
  console.log(`[Ghost] Stage 1: Classifying ${jobs.length} jobs with llama-3.1-8b-instant...`);

  const snippets = jobs
    .map((j, i) => `${i + 1}. ID:${j.external_id} | ${j.title} @ ${j.company} | Tags:${j.tags.join(',')} | ${j.description.substring(0, 200)}`)
    .join('\n');

  const prompt = `You are a strict recruiter screening jobs for an Indian candidate.

Candidate Profile:
${profileCtx}

Job Listings:
${snippets}

Return a JSON object with a single key "qualifying_ids" containing an array of external_id strings for ONLY the jobs that meet ALL these criteria:
1. Salary appears to be at or above ₹12L LPA (if disclosed). If salary is NOT mentioned, include the job (don't penalize).
2. Seniority is Entry-level, Mid-level, or unspecified — NOT "Senior 5+ years", "Lead", "Principal", "Director".
3. Role matches the candidate's target: Design Engineer, Full-stack, Frontend, or AI Engineer.
4. If the job description explicitly states 'US Only', 'Remote (US)', 'North America Only', or requires US/EU work authorization/visas, you MUST reject the job and set match_score to 0. Only accept roles that are truly global 'Work from Anywhere', explicitly 'Remote India', or located in Pune, India.

Return ONLY valid JSON in this exact format:
{"qualifying_ids": ["<id1>", "<id2>"]}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text) as { qualifying_ids?: string[] };
    const ids = Array.isArray(parsed.qualifying_ids) ? parsed.qualifying_ids : [];
    console.log(`[Ghost] Stage 1: ${ids.length}/${jobs.length} jobs passed classification`);
    return ids;
  } catch (err) {
    console.error('[Ghost] Stage 1 classification failed:', err);
    // Fallback: pass all jobs through
    return jobs.map(j => j.external_id);
  }
}

// ─── Stage 2: Deep Distillation (llama-3.3-70b-versatile) ────────────────────
// Generates the full Scout Report for a single job
async function stage2_distill(
  job: RawJob,
  profileCtx: string,
  groq: Groq
): Promise<{ distilled: DistilledData; match_score: number; match_logic: string }> {
  const prompt = `You are an elite technical recruiter and career coach. Generate a complete Scout Report for this job application.

Candidate Profile:
${profileCtx}

Job:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Tags: ${job.tags.join(', ')}
Description: ${job.description}

Return a JSON object with EXACTLY these keys:
{
  "match_score": <integer 0-100>,
  "match_logic": "<one crisp sentence explaining the score>",
  "gaps": ["<skill or experience gap 1>", "<gap 2>", ...],
  "hooks": ["<personalised outreach opening line 1>", "<variation 2>", "<variation 3>"],
  "tailored_bullets": ["<ATS-optimised resume bullet 1 that maps candidate's experience to this JD>", ...]
}

Scoring guide:
- 90–100: Perfect alignment (role, stack, remote/India, salary, seniority)
- 80–89: Strong fit, minor gaps
- 70–79: Relevant but noticeable mismatches
- <70: Weak match

For gaps: list specific missing skills or experience. If none, return empty array.
For hooks: Do not write generic hooks like 'I am impressed by your company.' Generate a 'Kinetic Hook' (max 3 sentences). It must reference a specific technology or problem mentioned in the JD, and tie it directly to my background as a Design Engineer building AI SaaS (e.g., mention my experience building agents with Next.js/Prisma or UI/UX). It must read like a sharp, direct message to a technical hiring manager.
For tailored_bullets: Generate 3 highly tailored bullet points for my resume based on this specific JD. Do not just summarize the job. You must rewrite my existing project experience (building 'Kindly.ai', the 'StayReach' dashboard, and the 'Shift' task manager) to perfectly align with the keywords and requirements of this role.`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(text) as {
    match_score?: number;
    match_logic?: string;
    gaps?: string[];
    hooks?: string[];
    tailored_bullets?: string[];
  };

  return {
    match_score: Math.min(100, Math.max(0, Number(parsed.match_score ?? 70))),
    match_logic: String(parsed.match_logic ?? ''),
    distilled: {
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
      tailored_bullets: Array.isArray(parsed.tailored_bullets) ? parsed.tailored_bullets : [],
      match_score: Number(parsed.match_score ?? 70),
      match_logic: String(parsed.match_logic ?? ''),
    },
  };
}

// ─── Step 7: 🦄 Unicorn Email Alert ──────────────────────────────────────────
async function sendUnicornAlert(job: ScoredJob, email: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Ghost] 🦄 Unicorn match found but RESEND_API_KEY not set — skipping email');
    return;
  }
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Scout Ghost <onboarding@resend.dev>',
      to: email,
      subject: `🔥 Unicorn Match: ${job.title} at ${job.company}`,
      html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#050505;color:#FAFAFA;padding:32px;border-radius:14px;border:1px solid rgba(255,255,255,0.1)">
  <p style="color:#00FFC2;font-size:11px;font-weight:800;letter-spacing:.12em;margin:0 0 4px;text-transform:uppercase">👻 Scout Ghost · Unicorn Alert</p>
  <h1 style="color:#FAFAFA;font-size:24px;font-weight:800;margin:0 0 24px;line-height:1.2">A ${job.match_score}% match just dropped.</h1>
  <div style="background:#0E0E0E;border:1px solid rgba(0,255,194,0.2);border-radius:12px;padding:20px;margin-bottom:24px">
    <div style="margin-bottom:14px">
      <span style="background:linear-gradient(135deg,#00FFC2,#00E6AD);color:#050505;font-weight:800;padding:4px 12px;border-radius:20px;font-size:14px">${job.match_score}% Match 🦄</span>
    </div>
    <h2 style="color:#FAFAFA;font-size:20px;font-weight:700;margin:0 0 4px">${job.title}</h2>
    <p style="color:#A1A1AA;font-size:14px;margin:0 0 14px">${job.company} · ${job.location}</p>
    <p style="color:#71717A;font-size:13px;line-height:1.6;margin:0;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px">${job.match_logic}</p>
  </div>
  <a href="${job.url}" style="display:inline-block;background:#00FFC2;color:#050505;font-weight:800;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:14px">View &amp; Apply Now →</a>
  <p style="color:#27272A;font-size:11px;margin-top:28px;line-height:1.5">Auto-scouted by your Ghost Engine · Scout App<br>Next sweep: tomorrow 9:00 AM IST</p>
</div>`,
    });
    console.log(`[Ghost] 🦄 Unicorn email sent → ${email} | ${job.match_score}%: ${job.title}`);
  } catch (err) {
    console.error('[Ghost] Email failed:', err);
  }
}

// ─── Log sweep ────────────────────────────────────────────────────────────────
async function logSweep(opts: {
  query: string;
  jobs_found: number;
  jobs_saved: number;
  high_matches: number;
  status: string;
  error?: string;
}): Promise<void> {
  try {
    const admin = getAdminClient();
    await admin.from('ghost_sweeps').insert({
      ran_at: new Date().toISOString(),
      jobs_found: opts.jobs_found,
      jobs_saved: opts.jobs_saved,
      high_matches: opts.high_matches,
      status: opts.status,
      query_used: opts.query,
      error_message: opts.error ?? null,
    });
  } catch (err) {
    console.error('[Ghost] Failed to log sweep:', err);
  }
}

// ─── Main: conductGlobalSweep ─────────────────────────────────────────────────
export async function conductGlobalSweep(): Promise<SweepResult> {
  console.log('\n[Ghost] 👻 ════════════ Global Sweep Starting ════════════');
  const admin = getAdminClient();
  const groq = getGroq();

  // Get profile
  const { data: profile } = await admin
    .from('user_profile')
    .select('*')
    .limit(1)
    .maybeSingle();

  const salaryMin: number    = (profile?.salary_min as number | null) ?? 12;
  const contactEmail: string = (profile?.contact_email as string | null) ?? 'divyansh@example.com';
  const roles: string[]      = (Array.isArray(profile?.preferred_roles) && (profile!.preferred_roles as string[]).length > 0)
    ? (profile!.preferred_roles as string[])
    : ['Design Engineer', 'Full-stack', 'Frontend'];

  const rawSkills = profile?.skills as Record<string, string[]> | null;
  const skills = rawSkills
    ? Object.values(rawSkills).flat().filter((s): s is string => typeof s === 'string').slice(0, 20)
    : ['React', 'Next.js', 'TypeScript', 'Figma', 'Node.js'];

  const preferredRoles = roles.join(', ');
  const profileCtx = `
Candidate: ${String(profile?.name ?? 'Divyansh Baghel')} | 2025 CS Graduate | India
Target roles: ${preferredRoles}
Key skills: ${skills.join(', ')}
Salary target: ${String(salaryMin ?? 12)}L–${String(profile?.salary_ideal ?? 18)}L INR LPA
Work preference: Remote / Hybrid
  `.trim();

  console.log(`[Ghost] Roles: ${roles.join(', ')} | Salary floor: ₹${salaryMin}L`);

  // ── STEP 1–3: Fetch from all sources
  const [serperResult, remoteOKResult, remotiveResult] = await Promise.allSettled([
    fetchSerper(roles),
    fetchRemoteOK(roles),
    fetchRemotive(roles),
  ]);

  if (serperResult.status === 'rejected')   console.warn('[Ghost] Serper failed:', serperResult.reason);
  if (remoteOKResult.status === 'rejected') console.warn('[Ghost] RemoteOK failed:', remoteOKResult.reason);
  if (remotiveResult.status === 'rejected') console.warn('[Ghost] Remotive failed:', remotiveResult.reason);

  const allRaw: RawJob[] = [
    ...(serperResult.status   === 'fulfilled' ? serperResult.value   : []),
    ...(remoteOKResult.status === 'fulfilled' ? remoteOKResult.value : []),
    ...(remotiveResult.status === 'fulfilled' ? remotiveResult.value : []),
  ];

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const deduped = allRaw.filter(j => {
    if (!j.url || seenUrls.has(j.url)) return false;
    seenUrls.add(j.url);
    return true;
  });
  console.log(`[Ghost] ${deduped.length} unique jobs from all sources`);

  // ── STEP 4: Hard Gate filter (age only)
  const gated = deduped.filter(j => passesHardGate(j));
  console.log(`[Ghost] ${gated.length} passed hard gate (age < 48h)`);

  if (gated.length === 0) {
    await logSweep({ query: roles.join(','), jobs_found: deduped.length, jobs_saved: 0, high_matches: 0, status: 'success' });
    return { jobs_found: deduped.length, jobs_filtered: 0, jobs_saved: 0, top_matches: 0 };
  }

  // ── STEP 5: Stage 1 — Rapid Classification (8B model)
  const qualifyingIds = await stage1_classify(gated, profileCtx, groq);
  const classified = gated.filter(j => qualifyingIds.includes(j.external_id));
  console.log(`[Ghost] ${classified.length} jobs passed Stage 1 classification`);

  if (classified.length === 0) {
    await logSweep({ query: roles.join(','), jobs_found: deduped.length, jobs_saved: 0, high_matches: 0, status: 'success' });
    return { jobs_found: deduped.length, jobs_filtered: gated.length, jobs_saved: 0, top_matches: 0 };
  }

  // ── STEP 6: Stage 2 — Deep Distillation (70B model, rate-limited)
  // Cap at MAX_DAILY_DISTILLATIONS to respect free-tier limits
  const toDistill = classified.slice(0, MAX_DAILY_DISTILLATIONS);
  console.log(`[Ghost] Stage 2: Distilling ${toDistill.length} jobs with llama-3.3-70b-versatile...`);

  let saved = 0;
  const unicorns: ScoredJob[] = [];

  for (let i = 0; i < toDistill.length; i++) {
    const job = toDistill[i];
    console.log(`[Ghost] Distilling ${i + 1}/${toDistill.length}: ${job.title} @ ${job.company}`);

    let distilledData: DistilledData | null = null;
    let matchScore = 70;
    let matchLogic = '';

    try {
      const result = await stage2_distill(job, profileCtx, groq);
      distilledData = result.distilled;
      matchScore = result.match_score;
      matchLogic = result.match_logic;
      console.log(`[Ghost] ✓ ${job.title}: ${matchScore}% match`);
    } catch (err) {
      console.error(`[Ghost] Stage 2 failed for "${job.title}":`, err);
      // Persist the job stub with pending=true if distillation failed
    }

    // ── Check for duplicate
    try {
      const { data: dup } = await admin
        .from('jobs')
        .select('id')
        .eq('apply_url', job.url)
        .maybeSingle();

      if (dup) {
        console.log(`[Ghost] Skip duplicate: ${job.title}`);
        // Still apply 3s delay before next distillation
        if (i < toDistill.length - 1) await new Promise(r => setTimeout(r, 3000));
        continue;
      }
    } catch { /* proceed with insert */ }

    // ── Upsert to Supabase
    try {
      const { error } = await admin.from('jobs').insert({
        company:              { name: job.company, size: 'Startup', industry: 'Technology' },
        role:                 job.title,
        experience_level:     'Entry-level',
        job_type:             'Full-time',
        pay:                  { min: 0, max: 0, currency: 'INR' },
        remote_status:        'Remote',
        location:             job.location || 'Remote',
        tech_stack:           job.tags.slice(0, 10),
        match_score:          matchScore,
        match_explanation:    matchLogic,
        missing_skills:       distilledData?.gaps?.slice(0, 5) ?? [],
        description:          job.description,
        responsibilities:     distilledData?.tailored_bullets?.slice(0, 3) ?? [],
        requirements:         [],
        apply_url:            job.url,
        posted_at:            job.posted_at,
        is_active:            true,
        tags:                 job.tags,
        status:               'casual',
        distillation_pending: distilledData === null, // false if distilled, true if failed
        distilled_data:       distilledData,          // null if distillation failed
        source:               job.source,
        snippet:              job.description,
      });

      if (!error) {
        saved++;
        if (matchScore >= 95) unicorns.push({ ...job, match_score: matchScore, match_logic: matchLogic });
        console.log(`[Ghost] ✓ Saved: ${job.title} | score=${matchScore} | distilled=${!!distilledData}`);
      } else {
        console.warn('[Ghost] Insert error:', error.message);
      }
    } catch (err) {
      console.warn('[Ghost] Save error:', err);
    }

    // ── 3s delay between 70B requests (free-tier safety)
    if (i < toDistill.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`[Ghost] Saved ${saved} jobs | Unicorns (95%+): ${unicorns.length}`);

  // ── STEP 7: 🦄 Unicorn Email Alerts
  for (const u of unicorns) {
    await sendUnicornAlert(u, contactEmail);
  }

  // ── Log sweep
  await logSweep({
    query:        roles.join(','),
    jobs_found:   deduped.length,
    jobs_saved:   saved,
    high_matches: unicorns.length,
    status:       'success',
  });

  console.log('[Ghost] 👻 ════════════ Sweep Complete ════════════\n');
  return { jobs_found: deduped.length, jobs_filtered: classified.length, jobs_saved: saved, top_matches: unicorns.length };
}
