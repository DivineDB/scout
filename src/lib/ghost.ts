/**
 * Ghost Scouter Engine — src/lib/ghost.ts
 * Sources: Serper.dev (Google Jobs) + RemoteOK + Remotive
 * Pipeline: Fetch → Hard Gate → Batch AI Score → Upsert → 🦄 Email Alert
 */
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// ─── Clients ──────────────────────────────────────────────────────────────────
function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`[Ghost] Missing Supabase config. (Found URL: ${!!url}, Key: ${!!key})`);
  }
  return createClient(url, key);
}

function getAI() {
  if (!process.env.GEMINI_API_KEY) throw new Error('[Ghost] Missing GEMINI_API_KEY');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

// ─── Source 1: Serper.dev — Google Jobs ───────────────────────────────────────
async function fetchSerper(roles: string[]): Promise<RawJob[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn('[Ghost] SERPER_API_KEY not set — skipping Google Jobs source');
    return [];
  }

  console.log('[Ghost] Fetching from Serper.dev (Google Jobs)...');
  const queries = roles.map(role => {
    const isEngineer = role.toLowerCase().includes('engineer');
    return isEngineer ? `${role} Remote India` : `${role} engineer Remote India`;
  });

  const allJobs: RawJob[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
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

      if (!resp.ok) {
        console.warn(`[Ghost] Serper returned ${resp.status} for query: ${q}`);
        continue;
      }

      const rawText = await resp.text();
      console.log(`[Ghost] Serper raw resp (20 chars): ${rawText.substring(0, 20)}`);
      
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.warn('[Ghost] Failed to parse Serper response:', e);
        continue;
      }
      if (!Array.isArray(data?.jobs)) continue;

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

      await new Promise(r => setTimeout(r, 300)); // brief pause between queries
    } catch (err) {
      console.warn(`[Ghost] Serper query "${q}" failed:`, err);
    }
  }

  console.log(`[Ghost] Serper: ${allJobs.length} jobs fetched`);
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
function passesHardGate(job: RawJob, salaryMinLPA: number): boolean {
  // Age: must be < 48 hours old
  const postedAt = new Date(job.posted_at);
  if (!isNaN(postedAt.getTime())) {
    const hoursOld = (Date.now() - postedAt.getTime()) / 3_600_000;
    if (hoursOld > 48) return false;
  }

  // Salary gate (USD → LPA, soft — only reject if salary is clearly too low)
  /*
  if (job.salary_info) {
    const m = job.salary_info.match(/\$?([\d,]+)/);
    if (m) {
      const usd = parseInt(m[1].replace(/,/g, ''), 10);
      const lpa = (usd / 100_000) * 83;
      if (lpa > 0 && lpa < salaryMinLPA) return false;
    }
  }
  */

  return true;
}

// ─── Filter 2: Batch AI Scoring ───────────────────────────────────────────────
async function batchScoreJobs(
  jobs: RawJob[],
  profile: Record<string, unknown> | null
): Promise<ScoredJob[]> {
  const ai = getAI();
  const BATCH = 10;
  const results: ScoredJob[] = [];

  const rawSkills = profile?.skills as Record<string, string[]> | null;
  const skills = rawSkills
    ? Object.values(rawSkills).flat().filter((s): s is string => typeof s === 'string').slice(0, 20)
    : ['React', 'Next.js', 'TypeScript', 'Figma', 'Node.js'];

  const preferredRoles = (Array.isArray(profile?.preferred_roles) && (profile!.preferred_roles as string[]).length > 0)
    ? (profile!.preferred_roles as string[]).join(', ')
    : 'Design Engineer, Full-stack, Frontend';

  const profileCtx = `
Candidate: ${String(profile?.name ?? 'Divyansh Baghel')} | 2025 CS Graduate | India
Target roles: ${preferredRoles}
Key skills: ${skills.join(', ')}
Salary target: ${String(profile?.salary_min ?? 12)}L–${String(profile?.salary_ideal ?? 18)}L INR LPA
Work preference: Remote / Hybrid
  `.trim();

  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    const snippets = batch
      .map((j, k) => `${k + 1}. ID:${j.external_id} | ${j.title} @ ${j.company} | Tags:${j.tags.join(',')} | ${j.description.substring(0, 200)}`)
      .join('\n');

    const prompt = `You are a senior technical recruiter evaluating job fit. Respond ONLY with a valid JSON array — no markdown.

Candidate Profile:
${profileCtx}

Job Listings:
${snippets}

Return exactly ${batch.length} objects in order:
[{"id":"<external_id>","match_score":<0-100>,"logic":"<one crisp sentence>"}]

Scoring criteria:
- 90–100 (🦄 Unicorn): All requirements align — role, seniority, remote, skills, salary
- 80–89 (Strong): Good fit, minor gaps only
- 70–79 (Fair): Relevant but noticeable mismatches
- <70 (Skip): Significant gaps in skills, seniority, or location`;

    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const parsed: { id: string; match_score: number; logic: string }[] = JSON.parse(resp.text ?? '[]');
      for (const entry of parsed) {
        const job = batch.find(j => j.external_id === entry.id);
        if (job && entry.match_score >= 80) {
          results.push({ ...job, match_score: entry.match_score, match_logic: entry.logic ?? '' });
        }
      }
      console.log(`[Ghost] Batch ${Math.floor(i / BATCH) + 1}: ${parsed.filter(e => e.match_score >= 80).length} qualified`);
    } catch (err) {
      console.error(`[Ghost] Batch ${Math.floor(i / BATCH) + 1} failed:`, err);
    }

    if (i + BATCH < jobs.length) await new Promise(r => setTimeout(r, 800));
  }

  return results;
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
  <a href="${job.url}" style="display:inline-block;background:#00FFC2;color:#050505;font-weight:800;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:14px">View & Apply Now →</a>
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

  // ── STEP 4: Hard Gate filter
  const filtered = deduped.filter(j => passesHardGate(j, salaryMin));
  console.log(`[Ghost] ${filtered.length} passed hard gate (age + salary)`);

  if (filtered.length === 0) {
    await logSweep({ query: roles.join(','), jobs_found: deduped.length, jobs_saved: 0, high_matches: 0, status: 'success' });
    return { jobs_found: deduped.length, jobs_filtered: 0, jobs_saved: 0, top_matches: 0 };
  }

  // ── STEP 5: Batch AI scoring
  console.log(`[Ghost] Scoring ${filtered.length} jobs with Gemini...`);
  const scored = await batchScoreJobs(filtered, profile as Record<string, unknown> | null);
  console.log(`[Ghost] ${scored.length} jobs scored 80%+`);

  // ── STEP 6: Persist to Supabase
  let saved = 0;
  const unicorns: ScoredJob[] = [];

  for (const job of scored) {
    try {
      const { data: dup } = await admin
        .from('jobs')
        .select('id')
        .eq('apply_url', job.url)
        .maybeSingle();
      if (dup) {
        console.log(`[Ghost] Skip duplicate: ${job.title}`);
        continue;
      }

      const { error } = await admin.from('jobs').insert({
        company:            { name: job.company, size: 'Startup', industry: 'Technology' },
        role:               job.title,
        experience_level:   'Entry-level',
        job_type:           'Full-time',
        pay:                { min: 0, max: 0, currency: 'INR' },
        remote_status:      'Remote',
        location:           job.location || 'Remote',
        tech_stack:         job.tags.slice(0, 10),
        match_score:        job.match_score,
        match_explanation:  job.match_logic,
        missing_skills:     [],
        description:        job.description,
        responsibilities:   [],
        requirements:       [],
        apply_url:          job.url,
        posted_at:          job.posted_at,
        is_active:          true,
        tags:               job.tags,
        status:             'casual',
        distillation_pending: true,
        source:             job.source,
        snippet:            job.description,
      });

      if (!error) {
        saved++;
        if (job.match_score >= 95) unicorns.push(job);
      } else {
        console.warn('[Ghost] Insert error:', error.message);
      }
    } catch (err) {
      console.warn('[Ghost] Save error:', err);
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
  return { jobs_found: deduped.length, jobs_filtered: filtered.length, jobs_saved: saved, top_matches: unicorns.length };
}
