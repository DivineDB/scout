/**
 * POST /api/scout/search
 * On-demand dynamic job search. Bypasses user_profile preferences entirely.
 * Takes { keyword, location } from the request body, fires a live Serper /jobs
 * query, saves stubs to Supabase with status='casual', returns the raw list.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface SerperJob {
  jobId?: string;
  title?: string;
  companyName?: string;
  description?: string;
  applyLink?: string;
  jobHighlightsLink?: string;
  date?: string;
  location?: string;
  extensions?: string[];
  salary?: string;
}

interface SearchRequestBody {
  keyword: string;
  location: string;
}

interface SavedJobStub {
  id: string;
  role: string;
  company: { name: string; size: string; industry: string };
  description: string;
  apply_url: string;
  location: string;
  tech_stack: string[];
  tags: string[];
  match_score: number;
  status: string;
  source: string;
  posted_at: string;
}

function parseRelativeDate(text: string): string {
  const now = Date.now();
  const t = text.toLowerCase();
  if (t.includes("hour")) return new Date(now - (parseInt(t) || 1) * 3_600_000).toISOString();
  if (t.includes("day")) return new Date(now - (parseInt(t) || 1) * 86_400_000).toISOString();
  if (t.includes("week")) return new Date(now - (parseInt(t) || 1) * 604_800_000).toISOString();
  if (t.includes("just") || t.includes("now") || t.includes("today")) return new Date(now).toISOString();
  return new Date().toISOString();
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as Partial<SearchRequestBody>;
    const keyword = body.keyword?.trim();
    const location = body.location?.trim() || "Remote";

    if (!keyword) {
      return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SERPER_API_KEY is not configured" }, { status: 503 });
    }

    // Build the Serper query directly from user inputs — no profile involved
    const query = `${keyword} ${location}`;
    console.log(`[DynamicSearch] Serper query: "${query}"`);

    let serperJobs: SerperJob[] = [];

    // ── Primary: /jobs endpoint ───────────────────────────────────────────────
    try {
      const resp = await fetch("https://google.serper.dev/jobs", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "in", hl: "en" }),
        signal: AbortSignal.timeout(12000),
      });

      if (resp.ok) {
        const data = await resp.json() as { jobs?: SerperJob[] };
        if (Array.isArray(data.jobs) && data.jobs.length > 0) {
          serperJobs = data.jobs;
          console.log(`[DynamicSearch] /jobs returned ${serperJobs.length} results`);
        }
      }
    } catch (err) {
      console.warn("[DynamicSearch] Serper /jobs failed:", err);
    }

    // ── ATS fallback: /search dork if /jobs came up empty ────────────────────
    if (serperJobs.length === 0) {
      const dork = `(site:jobs.lever.co OR site:boards.greenhouse.io OR site:jobs.ashbyhq.com) "${keyword}" ("${location}" OR "Remote" OR "Anywhere")`;
      console.log(`[DynamicSearch] ATS dork fallback: ${dork}`);
      try {
        const resp = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: dork, gl: "in", hl: "en", num: 10 }),
          signal: AbortSignal.timeout(12000),
        });
        if (resp.ok) {
          const data = await resp.json() as { organic?: Record<string, unknown>[] };
          const organic = Array.isArray(data.organic) ? data.organic : [];
          // Map organic results into SerperJob shape for uniform processing
          serperJobs = organic.map((r) => ({
            jobId: String(r.link ?? Math.random()),
            title: String(r.title ?? keyword),
            companyName: String(r.displayedLink ?? r.domain ?? "Via ATS"),
            description: String(r.snippet ?? ""),
            applyLink: String(r.link ?? ""),
            location: location,
          }));
          console.log(`[DynamicSearch] ATS fallback found ${serperJobs.length} results`);
        }
      } catch (err) {
        console.warn("[DynamicSearch] ATS fallback failed:", err);
      }
    }

    if (serperJobs.length === 0) {
      return NextResponse.json({ jobs: [], message: "No results found. Try different keywords." });
    }

    // ── Save stubs to Supabase immediately ────────────────────────────────────
    // Each stub is a lightweight record — no AI distillation at this stage.
    const stubs: SavedJobStub[] = [];

    for (const job of serperJobs.slice(0, 20)) {
      const applyUrl = job.applyLink ?? job.jobHighlightsLink ?? "";

      // Skip jobs with no apply URL
      if (!applyUrl) continue;

      // Dedup check by apply_url
      const { data: existing } = await supabaseAdmin
        .from("jobs")
        .select("id")
        .eq("apply_url", applyUrl)
        .maybeSingle();

      if (existing) {
        console.log(`[DynamicSearch] Skipping duplicate: ${job.title}`);
        continue;
      }

      const tags: string[] = Array.isArray(job.extensions) ? job.extensions.slice(0, 8) : [];

      const { data: saved, error } = await supabaseAdmin
        .from("jobs")
        .insert({
          company: {
            name: job.companyName ?? "Unknown",
            size: "Startup",
            industry: "Technology",
          },
          role: job.title ?? keyword,
          experience_level: "Entry-level",
          job_type: "Full-time",
          pay: { min: 0, max: 0, currency: "INR" },
          remote_status: "Remote",
          location: job.location ?? location,
          tech_stack: tags.slice(0, 6),
          match_score: 0,
          match_explanation: "Dynamic search — not yet AI-scored",
          missing_skills: [],
          description: (job.description ?? "").substring(0, 500),
          responsibilities: [],
          requirements: [],
          apply_url: applyUrl,
          posted_at: job.date ? parseRelativeDate(job.date) : new Date().toISOString(),
          is_active: true,
          tags,
          status: "casual",
          distillation_pending: true,
          source: "serper",
        })
        .select("id, role, company, description, apply_url, location, tech_stack, tags, match_score, status, source, posted_at")
        .single();

      if (error) {
        console.warn(`[DynamicSearch] Save failed for "${job.title}":`, error.message);
        continue;
      }

      if (saved) stubs.push(saved as unknown as SavedJobStub);
    }

    console.log(`[DynamicSearch] Saved ${stubs.length} new job stubs`);
    return NextResponse.json({ jobs: stubs, total: stubs.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DynamicSearch] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
