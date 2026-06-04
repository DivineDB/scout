/**
 * Ghost Scouter Engine — src/lib/ghost.ts
 * Sources: Serper.dev (Google Jobs) + RemoteOK + Remotive
 * Pipeline: Fetch → Stage1 Groq Classify → Stage2 Groq Distill → Upsert → 🦄 Email Alert
 */
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_DAILY_DISTILLATIONS = 30; // free-tier 70B rate-limit safety cap

// ─── Clients ──────────────────────────────────────────────────────────────────
function getAdminClient() {
	const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key =
		process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
	if (!url || !key) {
		throw new Error(
			`[Ghost] Missing Supabase config. (Found URL: ${!!url}, Key: ${!!key})`,
		);
	}
	return createClient(url, key);
}

function getGroq(): Groq {
	const apiKey = process.env.GROQ_API_KEY;
	if (!apiKey) throw new Error("[Ghost] Missing GROQ_API_KEY");
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
	source: "serper" | "remoteok" | "remotive";
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

export interface UserProfile {
	id: string;
	preferred_roles?: string[];
	preferred_location?: string[] | string;
	preferred_experience?: string[];
	salary_min?: number;
	salary_ideal?: number;
	contact_email?: string;
	skills?: Record<string, string[]> | any;
}

// ─── Role keywords ────────────────────────────────────────────────────────────
const ROLE_KEYWORDS: Record<string, string[]> = {
	"Design Engineer": [
		"design engineer",
		"product designer",
		"ui engineer",
		"ux engineer",
		"design systems",
	],
	"Full-stack": [
		"full stack",
		"fullstack",
		"full-stack",
		"software engineer",
		"software developer",
	],
	Frontend: [
		"frontend",
		"front-end",
		"front end",
		"react developer",
		"next.js",
	],
	"AI Engineer": [
		"ai engineer",
		"ml engineer",
		"machine learning",
		"llm",
		"genai",
	],
};

function matchesRole(title: string, roles: string[]): boolean {
	const lower = title.toLowerCase();
	return roles.some((r) =>
		(ROLE_KEYWORDS[r] ?? [r.toLowerCase()]).some((kw) => lower.includes(kw)),
	);
}

// ─── Parse "X days ago" → ISO date ───────────────────────────────────────────
function parseRelativeDate(text: string): string {
	const now = Date.now();
	const t = text.toLowerCase();
	if (t.includes("hour"))
		return new Date(now - (parseInt(t) || 1) * 3_600_000).toISOString();
	if (t.includes("day"))
		return new Date(now - (parseInt(t) || 1) * 86_400_000).toISOString();
	if (t.includes("week"))
		return new Date(now - (parseInt(t) || 1) * 604_800_000).toISOString();
	if (t.includes("just") || t.includes("now") || t.includes("today"))
		return new Date(now).toISOString();
	return new Date().toISOString();
}

// ─── Source 1: Serper.dev — Google Jobs (with ATS fallback) ──────────────────
async function fetchSerper(
	roles: string[],
	locations: string[] = ["Remote India"],
): Promise<RawJob[]> {
	const apiKey = process.env.SERPER_API_KEY;
	if (!apiKey) {
		console.warn(
			"[Ghost] SERPER_API_KEY not set — skipping Google Jobs source",
		);
		return [];
	}

	console.log(`[Ghost] Fetching from Serper.dev (Google Jobs) — locations: ${locations.join(", ")}`);

	// Generate smart combinations of roles and locations
	const queries: { q: string; role: string; loc: string; city?: string }[] = [];
	const workTypes = locations.filter(l => ["Remote", "Remote India", "Hybrid", "On-site"].includes(l));
	const targetCities = locations.filter(l => !["Remote", "Remote India", "Hybrid", "On-site"].includes(l));

	for (const role of roles) {
		if (targetCities.length > 0) {
			for (const city of targetCities) {
				const localWorkTypes = workTypes.filter(w => w !== "Remote" && w !== "Remote India");
				if (localWorkTypes.length > 0) {
					for (const wt of localWorkTypes) {
						queries.push({
							q: `${role} ${city} ${wt}`,
							role,
							loc: wt,
							city
						});
					}
				}
				// Always query the city itself to capture general local jobs
				queries.push({
					q: `${role} ${city}`,
					role,
					loc: city,
					city
				});
			}
			// If remote is also preferred, query remote separately
			const remoteTypes = workTypes.filter(w => w === "Remote" || w === "Remote India");
			for (const rt of remoteTypes) {
				queries.push({
					q: `${role} ${rt}`,
					role,
					loc: rt
				});
			}
		} else {
			// No city specified, query work types directly
			for (const loc of locations) {
				queries.push({
					q: `${role} ${loc}`,
					role,
					loc
				});
			}
		}
	}

	const allJobs: RawJob[] = [];
	const seen = new Set<string>();

	for (const queryObj of queries) {
		const q = queryObj.q;
		let jobsFetchedForQuery = false;

		// ── Primary: Strict POST to /jobs
		try {
			const resp = await fetch("https://google.serper.dev/jobs", {
				method: "POST",
				headers: {
					"X-API-KEY": apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ q, gl: "in", hl: "en" }),
				signal: AbortSignal.timeout(12000),
			});

			if (resp.ok) {
				let data;
				try {
					data = JSON.parse(await resp.text());
				} catch {
					/* fall through */
				}

				if (Array.isArray(data?.jobs) && data.jobs.length > 0) {
					for (const job of data.jobs) {
						const id = `serper-${job.jobId ?? job.title?.slice(0, 20) ?? Math.random()}`;
						if (seen.has(id)) continue;
						seen.add(id);
						allJobs.push({
							external_id: id,
							title: String(job.title ?? ""),
							company: String(job.companyName ?? "Unknown"),
							description: String(job.description ?? "").substring(0, 600),
							url: String(job.applyLink ?? job.jobHighlightsLink ?? ""),
							posted_at: job.date
								? parseRelativeDate(job.date)
								: new Date().toISOString(),
							tags: Array.isArray(job.extensions)
								? job.extensions.slice(0, 8)
								: [],
							salary_info: job.salary ?? undefined,
							location: String(job.location ?? "India"),
							source: "serper",
						});
					}
					jobsFetchedForQuery = true;
					console.log(`[Ghost] /jobs succeeded for: ${q}`);
				}
			} else {
				console.warn(
					`[Ghost] Serper /jobs returned ${resp.status} for query: ${q} — activating ATS fallback`,
				);
			}
		} catch (err) {
			console.warn(`[Ghost] Serper /jobs request failed for "${q}": ${err}`);
		}

		// ── ATS fallback dork on /search if /jobs failed (any error or non-ok)
		if (!jobsFetchedForQuery) {
			const locTerm = queryObj.city ? `"${queryObj.city}"` : `"${queryObj.loc}"`;
			const isRemote = queryObj.loc.toLowerCase().includes("remote");
			const dorkQuery = isRemote
				? `(site:jobs.lever.co OR site:boards.greenhouse.io OR site:jobs.ashbyhq.com) "${queryObj.role}" ("Remote" OR "Anywhere")`
				: `(site:jobs.lever.co OR site:boards.greenhouse.io OR site:jobs.ashbyhq.com) "${queryObj.role}" ${locTerm}`;
			console.log(`[Ghost] Serper ATS fallback dork: ${dorkQuery}`);

			try {
				const fallback = await fetch("https://google.serper.dev/search", {
					method: "POST",
					headers: {
						"X-API-KEY": apiKey,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ q: dorkQuery, gl: "in", hl: "en", num: 10 }),
					signal: AbortSignal.timeout(12000),
				});

				if (fallback.ok) {
					let fallbackData;
					try {
						fallbackData = JSON.parse(await fallback.text());
					} catch {
						/* skip */
					}

					const organicResults: Record<string, unknown>[] = Array.isArray(
						fallbackData?.organic,
					)
						? fallbackData.organic
						: [];

					for (const result of organicResults) {
						const link = String(result.link ?? "");
						if (!link) continue;
						const id = `serper-dork-${link.slice(-40)}`;
						if (seen.has(id)) continue;
						seen.add(id);

						let displayLoc = queryObj.city || queryObj.loc;
						if (queryObj.city && ["On-site", "Hybrid"].includes(queryObj.loc)) {
							displayLoc = `${queryObj.city} (${queryObj.loc})`;
						}

						allJobs.push({
							external_id: id,
							title: String(result.title ?? queryObj.role),
							company: String(
								result.displayedLink ?? result.domain ?? "Via ATS",
							),
							description: String(result.snippet ?? "").substring(0, 600),
							url: link,
							posted_at: new Date().toISOString(),
							tags: [queryObj.role],
							salary_info: undefined,
							location: displayLoc,
							source: "serper",
						});
					}
					console.log(
						`[Ghost] ATS fallback found ${organicResults.length} results for: ${queryObj.role}`,
					);
				} else {
					console.warn(
						`[Ghost] ATS fallback /search also failed: ${fallback.status}`,
					);
				}
			} catch (err) {
				console.warn(
					`[Ghost] ATS fallback request failed for "${queryObj.role}": ${err}`,
				);
			}
		}

		await new Promise((r) => setTimeout(r, 300)); // brief pause between queries
	}

	console.log(
		`[Ghost] Serper: ${allJobs.length} jobs fetched (primary + ATS fallback)`,
	);
	return allJobs;
}

// ─── Source 2: RemoteOK ───────────────────────────────────────────────────────
async function fetchRemoteOK(roles: string[]): Promise<RawJob[]> {
	console.log("[Ghost] Fetching from RemoteOK...");
	const resp = await fetch("https://remoteok.com/api", {
		headers: { "User-Agent": "Scout/1.0 Job Hunter" },
		signal: AbortSignal.timeout(15000),
	});
	if (!resp.ok) throw new Error(`RemoteOK: ${resp.status}`);
	const data = await resp.json();
	const listings = Array.isArray(data) ? data.slice(1) : [];

	return listings
		.filter((j: Record<string, unknown>) =>
			matchesRole(String(j.position ?? ""), roles),
		)
		.map((j: Record<string, unknown>) => {
			const id = String(j.id ?? Math.random());
			return {
				external_id: `remoteok-${id}`,
				title: String(j.position ?? ""),
				company: String(j.company ?? "Unknown"),
				description: String(j.description ?? "")
					.replace(/<[^>]*>/g, "")
					.substring(0, 600),
				url: String(j.url ?? `https://remoteok.com/l/${id}`),
				posted_at: String(j.date ?? new Date().toISOString()),
				tags: (Array.isArray(j.tags) ? (j.tags as string[]) : []).slice(0, 12),
				salary_info: j.salary_min
					? `$${j.salary_min}–$${j.salary_max ?? j.salary_min}`
					: undefined,
				location: "Remote",
				source: "remoteok" as const,
			};
		});
}

// ─── Source 3: Remotive ───────────────────────────────────────────────────────
async function fetchRemotive(roles: string[]): Promise<RawJob[]> {
	console.log("[Ghost] Fetching from Remotive...");
	const results = await Promise.all(
		roles.map((r) =>
			fetch(
				`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(r)}&limit=50`,
				{
					signal: AbortSignal.timeout(15000),
				},
			)
				.then((res) => res.json())
				.catch(() => ({ jobs: [] })),
		),
	);

	const seen = new Set<number>();
	const all: RawJob[] = [];

	for (const res of results) {
		for (const j of (res?.jobs ?? []) as Record<string, unknown>[]) {
			const id = Number(j.id ?? 0);
			if (seen.has(id)) continue;
			seen.add(id);
			if (!matchesRole(String(j.title ?? ""), roles)) continue;

			all.push({
				external_id: `remotive-${id}`,
				title: String(j.title ?? ""),
				company: String(j.company_name ?? "Unknown"),
				description: String(j.description ?? "")
					.replace(/<[^>]*>/g, "")
					.substring(0, 600),
				url: String(j.url ?? ""),
				posted_at: String(j.publication_date ?? new Date().toISOString()),
				tags: (Array.isArray(j.tags) ? (j.tags as string[]) : []).slice(0, 12),
				salary_info: j.salary ? String(j.salary) : undefined,
				location: String(j.candidate_required_location ?? "Remote"),
				source: "remotive",
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
	salaryMin: number,
	preferredExperiences: string[],
	groq: Groq,
): Promise<{ qualifyingIds: string[]; droppedLocation: number; droppedSalary: number }> {
	console.log(
		`[Ghost] Stage 1: Classifying ${jobs.length} total jobs with llama-3.1-8b-instant using chunking...`,
	);

	const CHUNK_SIZE = 15;
	const chunks: RawJob[][] = [];
	for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
		chunks.push(jobs.slice(i, i + CHUNK_SIZE));
	}

	const qualifyingIds: string[] = [];
	let droppedLocation = 0;
	let droppedSalary = 0;

	let chunkIndex = 0;
	for (const chunk of chunks) {
		chunkIndex++;
		console.log(
			`[Ghost] Stage 1: Processing chunk ${chunkIndex}/${chunks.length} (${chunk.length} jobs)...`,
		);

		const snippets = chunk
			.map(
				(j, i) =>
					`${i + 1}. ID:${j.external_id} | ${j.title} @ ${j.company} | Location: ${j.location} | Tags:${j.tags.join(",")} | ${j.description.substring(0, 200)}`,
			)
			.join("\n");

		const prompt = `You are a strict recruiter screening jobs for an Indian candidate.

Candidate Profile:
${profileCtx}

Job Listings:
${snippets}

Screen each job strictly based on these criteria:
1. Salary screening: If a job's salary is undisclosed, null, 0, or missing, it MUST pass this check. ONLY reject a job if it explicitly lists a salary that is definitively lower than ₹${salaryMin}L LPA. Do NOT reject undisclosed or missing salaries under any circumstances.
2. Seniority must align with candidate's target experience levels: ${preferredExperiences.join(", ")}. If experience level is unspecified, do not reject. But if it is explicitly outside this range (e.g. requires Senior/Lead/Principal years of experience when Senior/Lead/Principal is not in the preferred list), you MUST reject it.
3. Role must match the candidate's target roles listed in their profile above.
4. Location/Work Type screening:
   - If the candidate's preferred locations list contains 'Remote' or 'Remote India', then roles that are 'Remote' or 'Work from Anywhere' are acceptable.
   - If the candidate's preferred locations list does NOT contain 'Remote' or 'Remote India', you MUST reject all remote/work-from-anywhere roles.
   - For non-remote/hybrid/on-site roles, the job location MUST match or be in one of the candidate's preferred locations (e.g. Pune). Be highly lenient for jobs in Pune (the preferred local city) — do not reject them for minor mismatches, only reject if they are completely unrelated roles or require way too much seniority.
   - In all cases, if the job explicitly requires work authorization/visas outside India (e.g. US Only, North America Only, EU Only), you MUST reject the job.

Return a JSON object with two keys:
- "qualifying_ids": an array of external_id strings for jobs that passed all 4 criteria.
- "rejected_details": an array of objects, each having "id" (the job external_id) and "reason" (MUST be one of: "salary", "location", "seniority", or "role" representing the primary filter that caused its rejection).

Return ONLY valid JSON in this exact format:
{
  "qualifying_ids": ["<id1>", "<id2>"],
  "rejected_details": [
    { "id": "<id3>", "reason": "salary" },
    { "id": "<id4>", "reason": "location" }
  ]
}`;

		try {
			const response = await groq.chat.completions.create({
				model: "llama-3.1-8b-instant",
				messages: [{ role: "user", content: prompt }],
				response_format: { type: "json_object" },
				temperature: 0.1,
			});

			const text = response.choices[0]?.message?.content ?? "{}";
			const parsed = JSON.parse(text) as {
				qualifying_ids?: string[];
				rejected_details?: { id: string; reason: string }[];
			};

			const chunkQualifying = Array.isArray(parsed.qualifying_ids)
				? parsed.qualifying_ids
				: [];
			const chunkRejected = Array.isArray(parsed.rejected_details)
				? parsed.rejected_details
				: [];

			qualifyingIds.push(...chunkQualifying);
			droppedLocation += chunkRejected.filter((r) => r.reason === "location").length;
			droppedSalary += chunkRejected.filter((r) => r.reason === "salary").length;

		} catch (err) {
			console.error(`[Ghost] Stage 1 classification failed on chunk ${chunkIndex}/${chunks.length}:`, err);
			// Strict Failure State: fail closed, break the loop and return what we successfully processed up to this point
			break;
		}

		// Inject TPM cooldown delay of 3500ms between chunks (except after the final chunk)
		if (chunkIndex < chunks.length) {
			console.log(`[Ghost] Stage 1: Cooldown delay of 3500ms for Groq TPM bucket...`);
			await new Promise((resolve) => setTimeout(resolve, 3500));
		}
	}

	console.log(
		`[Ghost] Stage 1: Complete. ${qualifyingIds.length}/${jobs.length} jobs passed classification (Dropped Location: ${droppedLocation}, Salary: ${droppedSalary})`,
	);
	return { qualifyingIds, droppedLocation, droppedSalary };
}

// ─── Stage 2: Deep Distillation (llama-3.3-70b-versatile) ────────────────────
// Generates the full Scout Report for a single job
async function stage2_distill(
	job: RawJob,
	profileCtx: string,
	groq: Groq,
): Promise<{
	distilled: DistilledData;
	match_score: number;
	match_logic: string;
}> {
	const prompt = `You are an elite technical recruiter and career coach. Generate a complete Scout Report for this job application.

Candidate Profile:
${profileCtx}

Job:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Tags: ${job.tags.join(", ")}
Description: ${job.description}

Return a JSON object with EXACTLY these keys:
{
  "match_score": <integer 0-100>,
  "match_logic": "<one crisp sentence explaining the score>",
  "gaps": ["<skill or experience gap 1>", "<gap 2>", ...],
  "hooks": ["<personalised outreach opening line 1>", "<variation 2>", "<variation 3>"],
  "tailored_bullets": ["<ATS-optimised resume bullet 1 that maps candidate's experience to this JD>", ...]
}

Scoring guide & Local Boost:
- 90–100: Perfect alignment (role, stack, remote/India, salary, seniority)
- 80–89: Strong fit, minor gaps
- 70–79: Relevant but noticeable mismatches
- <70: Weak match
- CRITICAL LOCAL BOOST: If the job's location is on-site or hybrid in Pune (one of the candidate's preferred cities), you MUST reduce strictness and give the match score a +15 to +20 points boost! Even if there are skill gaps, salary mismatches, or minor experience gaps, rate it at least 80-95% (since local on-site opportunities in Pune are extremely rare and highly valued). Explain this boost in your match_logic.

For gaps: list specific missing skills or experience. If none, return empty array.
For hooks: Do not write generic hooks like 'I am impressed by your company.' Generate a 'Kinetic Hook' (max 3 sentences). It must reference a specific technology or problem mentioned in the JD, and tie it directly to my background as a Design Engineer building AI SaaS (e.g., mention my experience building agents with Next.js/Prisma or UI/UX). It must read like a sharp, direct message to a technical hiring manager.
For tailored_bullets: Write exactly 3 short, punchy resume bullets. Maximum 15 words per bullet. Start each with a strong action verb. DO NOT write long, run-on sentences. Focus purely on technical execution and UI/UX impact. Do not just summarize the job. You must rewrite my existing project experience (building 'Kindly.ai', the 'StayReach' dashboard, and the 'Shift' task manager) to perfectly align with the keywords and requirements of this role.`;

	const response = await groq.chat.completions.create({
		model: "llama-3.3-70b-versatile",
		messages: [{ role: "user", content: prompt }],
		response_format: { type: "json_object" },
		temperature: 0.3,
	});

	const text = response.choices[0]?.message?.content ?? "{}";
	const parsed = JSON.parse(text) as {
		match_score?: number;
		match_logic?: string;
		gaps?: string[];
		hooks?: string[];
		tailored_bullets?: string[];
	};

	return {
		match_score: Math.min(100, Math.max(0, Number(parsed.match_score ?? 70))),
		match_logic: String(parsed.match_logic ?? ""),
		distilled: {
			gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
			hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
			tailored_bullets: Array.isArray(parsed.tailored_bullets)
				? parsed.tailored_bullets
				: [],
			match_score: Number(parsed.match_score ?? 70),
			match_logic: String(parsed.match_logic ?? ""),
		},
	};
}

// ─── Step 7: 🦄 Unicorn Email Alert ──────────────────────────────────────────
async function sendUnicornAlert(job: ScoredJob, email: string): Promise<void> {
	if (!process.env.RESEND_API_KEY) {
		console.log(
			"[Ghost] 🦄 Unicorn match found but RESEND_API_KEY not set — skipping email",
		);
		return;
	}
	try {
		const { Resend } = await import("resend");
		const resend = new Resend(process.env.RESEND_API_KEY);
		await resend.emails.send({
			from: "Scout Ghost <onboarding@resend.dev>",
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
		console.log(
			`[Ghost] 🦄 Unicorn email sent → ${email} | ${job.match_score}%: ${job.title}`,
		);
	} catch (err) {
		console.error("[Ghost] Email failed:", err);
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
		await admin.from("ghost_sweeps").insert({
			ran_at: new Date().toISOString(),
			jobs_found: opts.jobs_found,
			jobs_saved: opts.jobs_saved,
			high_matches: opts.high_matches,
			status: opts.status,
			query_used: opts.query,
			error_message: opts.error ?? null,
		});
	} catch (err) {
		console.error("[Ghost] Failed to log sweep:", err);
	}
}

// ─── Main: conductGlobalSweep ─────────────────────────────────────────────────
export async function conductGlobalSweep(
	onProgress?: (progress: number, message: string) => void
): Promise<SweepResult> {
	console.log("\n[Ghost] 👻 ════════════ Global Sweep Starting ════════════");
	onProgress?.(5, "Loading candidate profile preferences...");
	const admin = getAdminClient();
	const groq = getGroq();

	// ── Pull live user profile from Supabase ────────────────────────────────
	let { data: profileRaw, error: profileError } = await admin
		.from("user_profile")
		.select("id, preferred_roles, preferred_location, preferred_experience, salary_min, salary_ideal, contact_email, skills")
		.limit(1)
		.single();

	let profile: UserProfile | null = profileRaw as UserProfile | null;

	if (profileError || !profile) {
		console.warn("[Ghost] No user_profile row found. Upserting default profile row to bypass abort...");
		
		const defaultProfile = {
			id: "11111111-1111-1111-1111-111111111111",
			preferred_roles: ["Design Engineer", "UI/UX Designer", "Product Designer"],
			preferred_location: ["Remote", "Hybrid", "On-site"],
			salary_min: 12
		};

		const { data: upsertedRaw, error: upsertError } = await admin
			.from("user_profile")
			.upsert(defaultProfile, { onConflict: "id" })
			.select("id, preferred_roles, preferred_location, preferred_experience, salary_min, salary_ideal, contact_email, skills")
			.single();

		if (upsertError || !upsertedRaw) {
			console.error("[Ghost] Failed to upsert default profile:", upsertError);
			return { jobs_found: 0, jobs_filtered: 0, jobs_saved: 0, top_matches: 0 };
		}

		profile = upsertedRaw as UserProfile;
	}

	// ── Strict profile-driven config (no hardcoded fallbacks) ────────────────
	const salaryMin: number = typeof profile.salary_min === "number" ? profile.salary_min : 12;
	const contactEmail: string = typeof profile.contact_email === "string" ? profile.contact_email : "";

	const roles: string[] =
		Array.isArray(profile.preferred_roles) && (profile.preferred_roles as string[]).length > 0
			? (profile.preferred_roles as string[])
			: ["Design Engineer", "Frontend"]; // stripped "Full-stack"

	// preferred_location: array of string
	const preferredLocations: string[] =
		Array.isArray(profile.preferred_location) && profile.preferred_location.length > 0
			? (profile.preferred_location as string[])
			: typeof profile.preferred_location === "string" && profile.preferred_location.trim()
			? [profile.preferred_location.trim()]
			: ["Remote India"];

	const preferredExperiences: string[] =
		Array.isArray(profile.preferred_experience) && profile.preferred_experience.length > 0
			? (profile.preferred_experience as string[])
			: ["Entry-level", "Junior", "Mid-level"];

	const rawSkills = profile.skills as Record<string, string[]> | null;
	const skills: string[] = rawSkills
		? Object.values(rawSkills)
				.flat()
				.filter((s): s is string => typeof s === "string")
				.slice(0, 20)
		: [];

	const profileCtx = [
		`Candidate: Divyansh Baghel | India`,
		`Target roles: ${roles.join(", ")}`,
		`Key skills: ${skills.join(", ")}`,
		`Salary target: ${salaryMin}L–${String(profile.salary_ideal ?? salaryMin + 6)}L INR LPA`,
		`Preferred locations: ${preferredLocations.join(", ")}`,
		`Target experience levels: ${preferredExperiences.join(", ")}`,
	].join("\n");

	console.log(
		`[Ghost] Profile loaded | Roles: ${roles.join(", ")} | Locations: ${preferredLocations.join(", ")} | Salary floor: ₹${salaryMin}L`,
	);
	onProgress?.(10, `Searching Google Jobs & remote boards for: ${roles.slice(0, 2).join(", ")}...`);

	const hasRemotePreference = preferredLocations.some((loc) => {
		const l = loc.toLowerCase();
		return l.includes("remote") || l.includes("anywhere") || l.includes("worldwide");
	});

	// ── STEP 1–3: Fetch from all sources (Serper gets locations from profile)
	const [serperResult, remoteOKResult, remotiveResult] =
		await Promise.allSettled([
			fetchSerper(roles, preferredLocations),
			hasRemotePreference ? fetchRemoteOK(roles) : Promise.resolve([]),
			hasRemotePreference ? fetchRemotive(roles) : Promise.resolve([]),
		]);

	if (serperResult.status === "rejected")
		console.warn("[Ghost] Serper failed:", serperResult.reason);
	if (remoteOKResult.status === "rejected")
		console.warn("[Ghost] RemoteOK failed:", remoteOKResult.reason);
	if (remotiveResult.status === "rejected")
		console.warn("[Ghost] Remotive failed:", remotiveResult.reason);

	const serperRawCount = serperResult.status === "fulfilled" ? serperResult.value.length : 0;

	const allRaw: RawJob[] = [
		...(serperResult.status === "fulfilled" ? serperResult.value : []),
		...(remoteOKResult.status === "fulfilled" ? remoteOKResult.value : []),
		...(remotiveResult.status === "fulfilled" ? remotiveResult.value : []),
	];

	// Deduplicate by URL
	const seenUrls = new Set<string>();
	const deduped = allRaw.filter((j) => {
		if (!j.url || seenUrls.has(j.url)) return false;
		seenUrls.add(j.url);
		return true;
	});
	console.log(`[Ghost] ${deduped.length} unique jobs from all sources`);
	onProgress?.(35, `Deduplicated ${deduped.length} unique jobs. Applying hard gating...`);

	// ── STEP 4: Hard Gate filter (age, seniority keywords, and strict location mention check)
	const gated = deduped.filter((j) => {
		if (!passesHardGate(j)) return false;

		const lowerTitle = j.title.toLowerCase();
		const hasSeniorPreferred = preferredExperiences.some(exp => exp.toLowerCase().includes("senior"));
		const hasLeadPreferred = preferredExperiences.some(exp => exp.toLowerCase().includes("lead") || exp.toLowerCase().includes("principal") || exp.toLowerCase().includes("staff") || exp.toLowerCase().includes("director") || exp.toLowerCase().includes("manager"));

		if (!hasSeniorPreferred) {
			const forbidden = ["senior", "sr.", "sr ", "lead", "principal", "staff", "director", "vp", "head", "manager"];
			if (forbidden.some(kw => lowerTitle.includes(kw))) {
				console.log(`[Ghost] Hard gate reject seniority (Senior/Lead keywords in non-senior profile) for: ${j.title}`);
				return false;
			}
		} else if (!hasLeadPreferred) {
			const forbidden = ["lead", "principal", "staff", "director", "vp", "head", "manager"];
			if (forbidden.some(kw => lowerTitle.includes(kw))) {
				console.log(`[Ghost] Hard gate reject seniority (Lead keywords in senior non-lead profile) for: ${j.title}`);
				return false;
			}
		}

		// ── Strict Location Gating ──
		const locLower = (j.location ?? "").toLowerCase();
		const descLower = (j.description ?? "").toLowerCase();

		const workTypes = preferredLocations.filter(l => ["Remote", "Remote India", "Hybrid", "On-site"].includes(l));
		const targetCities = preferredLocations.filter(l => !["Remote", "Remote India", "Hybrid", "On-site"].includes(l));

		const hasRemotePref = workTypes.some(w => w.toLowerCase().includes("remote"));
		const hasHybridPref = workTypes.includes("Hybrid");
		const hasOnSitePref = workTypes.includes("On-site");

		const isRemoteSource = j.source === "remoteok" || j.source === "remotive";
		const isJobRemote = isRemoteSource || locLower.includes("remote") || locLower.includes("anywhere") || locLower.includes("worldwide") || locLower.includes("work from home") || locLower.includes("wfh");
		const isJobHybrid = locLower.includes("hybrid") || descLower.includes("hybrid");

		if (isJobRemote) {
			if (!hasRemotePref) {
				console.log(`[Ghost] Hard gate reject location (Remote job, but user does not prefer remote) for: ${j.title}`);
				return false;
			}
		} else {
			// Local job (On-site or Hybrid)
			if (targetCities.length > 0) {
				// The job must mention at least one of the target cities in location, title, or description.
				const matchesCity = targetCities.some(city => {
					const c = city.toLowerCase();
					return locLower.includes(c) || lowerTitle.includes(c) || descLower.includes(c);
				});

				if (!matchesCity) {
					console.log(`[Ghost] Hard gate reject location (Local job, but does not match target cities: ${targetCities.join(", ")}) for: ${j.title}`);
					return false;
				}
			}

			// If work types specify modes (On-site / Hybrid), enforce them
			if (workTypes.includes("On-site") || workTypes.includes("Hybrid")) {
				if (isJobHybrid && !hasHybridPref) {
					console.log(`[Ghost] Hard gate reject location (Hybrid job, but user does not prefer hybrid) for: ${j.title}`);
					return false;
				}
				if (!isJobHybrid && !hasOnSitePref) {
					console.log(`[Ghost] Hard gate reject location (On-site job, but user does not prefer on-site) for: ${j.title}`);
					return false;
				}
			}
		}

		return true;
	});
	console.log(`[Ghost] ${gated.length} passed hard gate (age < 48h)`);
	onProgress?.(45, `Filtering ${gated.length} active listings through rapid 8B Llama Classifier...`);

	if (gated.length === 0) {
		await logSweep({
			query: roles.join(","),
			jobs_found: deduped.length,
			jobs_saved: 0,
			high_matches: 0,
			status: "success",
		});
		return {
			jobs_found: deduped.length,
			jobs_filtered: 0,
			jobs_saved: 0,
			top_matches: 0,
		};
	}

	// ── STEP 5: Stage 1 — Rapid Classification (8B model)
	const { qualifyingIds, droppedLocation, droppedSalary } = await stage1_classify(
		gated,
		profileCtx,
		salaryMin,
		preferredExperiences,
		groq
	);
	const classified = gated.filter((j) => qualifyingIds.includes(j.external_id));

	// Expose failure points in deployment logs
	console.log(`[Ghost] Funnel Breakdown:`);
	console.log(`  - Total Raw Jobs returned by Serper: ${serperRawCount}`);
	console.log(`  - Jobs dropped by the location filter: ${droppedLocation}`);
	console.log(`  - Jobs dropped by the salary filter: ${droppedSalary}`);

	console.log(
		`[Ghost] ${classified.length} jobs passed Stage 1 classification`,
	);
	onProgress?.(60, `Classified ${classified.length} high-match prospects. Initializing Deep Distillation...`);

	if (classified.length === 0) {
		await logSweep({
			query: roles.join(","),
			jobs_found: deduped.length,
			jobs_saved: 0,
			high_matches: 0,
			status: "success",
		});
		return {
			jobs_found: deduped.length,
			jobs_filtered: gated.length,
			jobs_saved: 0,
			top_matches: 0,
		};
	}

	// ── STEP 6: Stage 2 — Deep Distillation (70B model, rate-limited)
	// Cap at MAX_DAILY_DISTILLATIONS to respect free-tier limits
	const toDistill = classified.slice(0, MAX_DAILY_DISTILLATIONS);
	console.log(
		`[Ghost] Stage 2: Distilling ${toDistill.length} jobs with llama-3.3-70b-versatile...`,
	);

	let saved = 0;
	const unicorns: ScoredJob[] = [];

	for (let i = 0; i < toDistill.length; i++) {
		const job = toDistill[i];
		const progressStep = 60 + Math.floor(((i + 1) / toDistill.length) * 35);
		onProgress?.(progressStep, `Distilling via Llama 3.3 (${i + 1}/${toDistill.length}): ${job.title} @ ${job.company}...`);
		console.log(
			`[Ghost] Distilling ${i + 1}/${toDistill.length}: ${job.title} @ ${job.company}`,
		);

		let distilledData: DistilledData | null = null;
		let matchScore = 70;
		let matchLogic = "";

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
				.from("jobs")
				.select("id")
				.eq("apply_url", job.url)
				.maybeSingle();

			if (dup) {
				console.log(`[Ghost] Skip duplicate: ${job.title}`);
				// Still apply 3s delay before next distillation
				if (i < toDistill.length - 1)
					await new Promise((r) => setTimeout(r, 3000));
				continue;
			}
		} catch {
			/* proceed with insert */
		}

		// ── Upsert to Supabase
		try {
			const isRemoteSource = job.source === "remoteok" || job.source === "remotive";
			const locLower = (job.location ?? "").toLowerCase();
			const isRemote = isRemoteSource || locLower.includes("remote") || locLower.includes("anywhere") || locLower.includes("worldwide") || locLower.includes("work from home") || locLower.includes("wfh");
			const isHybrid = locLower.includes("hybrid");
			const remoteStatus = isRemote ? "Remote" : isHybrid ? "Hybrid" : "On-site";

			const { error } = await admin.from("jobs").insert({
				company: { name: job.company, size: "Startup", industry: "Technology" },
				role: job.title,
				experience_level: (preferredExperiences[0] || "Entry-level") as any,
				job_type: "Full-time",
				pay: { min: 0, max: 0, currency: "INR" },
				remote_status: remoteStatus,
				location: job.location || (isRemote ? "Remote" : "India"),
				tech_stack: job.tags.slice(0, 10),
				match_score: matchScore,
				match_explanation: matchLogic,
				missing_skills: distilledData?.gaps?.slice(0, 5) ?? [],
				description: job.description,
				responsibilities: distilledData?.tailored_bullets?.slice(0, 3) ?? [],
				requirements: [],
				apply_url: job.url,
				posted_at: job.posted_at,
				is_active: true,
				tags: job.tags,
				status: "casual",
				distillation_pending: distilledData === null, // false if distilled, true if failed
				distilled_data: distilledData, // null if distillation failed
				source: job.source,
				snippet: job.description,
			});

			if (!error) {
				saved++;
				if (matchScore >= 85)
					unicorns.push({
						...job,
						match_score: matchScore,
						match_logic: matchLogic,
					});
				console.log(
					`[Ghost] ✓ Saved: ${job.title} | score=${matchScore} | distilled=${!!distilledData}`,
				);
			} else {
				console.warn("[Ghost] Insert error:", error.message);
			}
		} catch (err) {
			console.warn("[Ghost] Save error:", err);
		}

		// ── 3s delay between 70B requests (free-tier safety)
		if (i < toDistill.length - 1) {
			await new Promise((r) => setTimeout(r, 3000));
		}
	}

	console.log(
		`[Ghost] Saved ${saved} jobs | Unicorns (95%+): ${unicorns.length}`,
	);

	// ── STEP 7: 🦄 Unicorn Email Alerts
	for (const u of unicorns) {
		await sendUnicornAlert(u, contactEmail);
	}

	// ── Log sweep
	await logSweep({
		query: roles.join(","),
		jobs_found: deduped.length,
		jobs_saved: saved,
		high_matches: unicorns.length,
		status: "success",
	});

	console.log("[Ghost] 👻 ════════════ Sweep Complete ════════════\n");
	onProgress?.(100, `Sweep complete. Added ${saved} new matching jobs.`);
	return {
		jobs_found: deduped.length,
		jobs_filtered: classified.length,
		jobs_saved: saved,
		top_matches: unicorns.length,
	};
}
