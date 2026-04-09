// ─────────────────────────────────────────────────────────────────────────────
// Scout – Job Post Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type RemoteStatus = "Remote" | "Hybrid" | "On-site";

export type ExperienceLevel =
  | "Internship"
  | "Entry-level"
  | "Mid-level"
  | "Senior"
  | "Lead"
  | "Principal";

export type JobType = "Full-time" | "Part-time" | "Contract" | "Freelance";

// Pay range expressed in INR LPA (Lakhs Per Annum)
export interface PayRange {
  /** Minimum salary offered (INR LPA) */
  min: number;
  /** Maximum salary offered (INR LPA) */
  max: number;
  /** Currency code, defaults to INR */
  currency?: string;
}

export interface Company {
  /** Display name of the company */
  name: string;
  /** Company logo URL or path */
  logo_url?: string;
  /** Company website */
  website?: string;
  /** Approximate headcount: "Startup", "Mid-size", "Large", "Enterprise" */
  size: "Startup" | "Mid-size" | "Large" | "Enterprise";
  /** Industry vertical e.g. "FinTech", "EdTech", "SaaS" */
  industry: string;
}

export interface JobPost {
  /** Unique identifier for the job post */
  id: string;

  /** Company details */
  company: Company;

  /** Job title / role name */
  role: string;

  /** Seniority / experience level */
  experience_level: ExperienceLevel;

  /** Employment type */
  job_type: JobType;

  /** Compensation range */
  pay: PayRange;

  /** Work location flexibility */
  remote_status: RemoteStatus;

  /** Location string (city or "Worldwide" for fully remote) */
  location: string;

  /** Ordered list of required/preferred technologies */
  tech_stack: string[];

  /**
   * How well this job matches the user's profile.
   * Value between 0 and 100 (inclusive).
   * 90+ = Excellent, 70-89 = Good, 50-69 = Fair, <50 = Low
   */
  match_score: number;

  /** 1-sentence reason why this job matches the user */
  match_explanation?: string;

  /** Tags in JD but not in me.json */
  missing_skills?: string[];

  /** Short summary of the role (1–3 sentences) */
  description: string;

  /** Key responsibilities */
  responsibilities: string[];

  /** Must-have qualifications */
  requirements: string[];

  /** Application URL */
  apply_url: string;

  /** ISO 8601 date the job was posted */
  posted_at: string;

  /** ISO 8601 deadline to apply (optional) */
  apply_by?: string;

  /** Whether this listing is still active */
  is_active: boolean;

  /** Tags for filtering e.g. ["AI", "React", "Remote-first"] */
  tags: string[];

  /** Status of the job in the pipeline */
  status: "casual" | "serious";

  /** AI-generated outreach hook (persisted to DB) */
  hook?: string;

  /** True when user profile changed and match_score needs re-validation */
  match_stale?: boolean;
}
