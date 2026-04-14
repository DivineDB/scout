import { NextResponse } from "next/server";
import { fetchJobPage, fetchCompanyIntel, distillJobData } from "@/lib/scout";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/scout/distill
 * Re-distills a single existing job by ID.
 * Fetches the stored apply_url, re-scrapes and re-runs Gemini analysis,
 * then patches match_score, match_explanation, missing_skills, and description.
 */
export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    console.log(`[Distill] Incoming jobId: "${jobId}" (type: ${typeof jobId})`);

    // 1. Fetch the existing job row
    const { data: existingJob, error: fetchError } = await supabaseAdmin
      .from("jobs")
      .select("id, apply_url, company")
      .eq("id", jobId)
      .single();

    console.log(`[Distill] Fetch result — found: ${!!existingJob}, error: ${fetchError?.message ?? "none"}`);

    if (fetchError || !existingJob) {
      return NextResponse.json(
        { error: `Job not found for id: ${jobId}`, supabase_error: fetchError?.message },
        { status: 404 }
      );
    }

    const applyUrl: string = existingJob.apply_url;
    const companyName: string = existingJob.company?.name || "Unknown Company";

    console.log(`[Distill] Re-distilling job ${jobId} from ${applyUrl}`);

    // 2. Scrape fresh content
    const rawText = await fetchJobPage(applyUrl);
    if (!rawText) {
      return NextResponse.json({ error: "Failed to scrape job URL" }, { status: 400 });
    }

    // 3. Fetch company intel
    const companyIntel = await fetchCompanyIntel(companyName);

    // 4. Re-distill via Gemini
    const distilled = await distillJobData(rawText, companyIntel);

    // 5. Patch only the AI-generated fields (don't overwrite user edits to status etc.)
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("jobs")
      .update({
        match_score: distilled.match_score,
        match_explanation: distilled.match_explanation,
        missing_skills: distilled.missing_skills ?? [],
        description: distilled.description,
        tech_stack: distilled.tech_stack,
        requirements: distilled.requirements,
        role: distilled.role,
        company: distilled.company,
        pay: distilled.pay,
        remote_status: distilled.remote_status,
        location: distilled.location,
        tags: distilled.tags,
        responsibilities: distilled.responsibilities,
        apply_url: distilled.apply_url || existingJob.apply_url,
        distillation_pending: false,
        match_stale: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single();

    if (updateError) {
      console.error("[Distill] DB update error:", updateError);
      return NextResponse.json({ error: "Failed to update job", details: updateError }, { status: 500 });
    }

    console.log(`[Distill] Successfully re-distilled job ${jobId}`);
    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    console.error("[Distill] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
