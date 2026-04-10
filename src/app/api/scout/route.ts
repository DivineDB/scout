import { NextResponse } from "next/server";
import { fetchJobPage, fetchCompanyIntel, distillJobData } from "@/lib/scout";
import { supabaseAdmin } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`[Scout] Starting pipeline for ${url}`);

    // ── Step 1: Scrape the URL ────────────────────────────────────────────────
    const rawText = await fetchJobPage(url);
    if (!rawText) {
      return NextResponse.json({ error: "Failed to extract text from URL." }, { status: 400 });
    }

    // ── Step 2: Extract company name (lightweight call) ───────────────────────
    console.log(`[Scout] Extracting company name...`);
    let companyName = "Unknown Company";
    try {
      const companyResponse = await ai.models.generateContent({
        model: "gemini-1.5-flash-latest",
        contents: `Extract the primary company name hiring for this job from the raw text. Return ONLY the company name as a string, nothing else.\n\nText: ${rawText.substring(0, 4000)}`
      });
      companyName = companyResponse.text?.trim() || "Unknown Company";
    } catch (e) {
      console.warn("[Scout] Company extraction failed, using fallback:", e);
    }

    // ── Step 3: Save a RAW STUB to Supabase immediately ───────────────────────
    // This guarantees a real UUID is created even if Gemini distillation fails.
    console.log(`[Scout] Saving stub to database for guaranteed UUID...`);
    const { data: stub, error: stubError } = await supabaseAdmin
      .from("jobs")
      .insert({
        company: { name: companyName, size: "Startup", industry: "Technology" },
        role: "Pending AI Distillation",
        experience_level: "Entry-level",
        job_type: "Full-time",
        pay: { min: 0, max: 0, currency: "INR" },
        remote_status: "Remote",
        location: "India",
        tech_stack: [],
        match_score: 0,
        match_explanation: "Pending AI distillation...",
        missing_skills: [],
        description: rawText.substring(0, 500),
        responsibilities: [],
        requirements: [],
        apply_url: url,
        posted_at: new Date().toISOString(),
        is_active: true,
        tags: [],
        status: "casual",
        distillation_pending: true,
      })
      .select()
      .single();

    if (stubError || !stub) {
      console.error("[Scout] CRITICAL: Stub save failed:", stubError);
      return NextResponse.json(
        { error: "Failed to create job entry in database", details: stubError },
        { status: 500 }
      );
    }

    const jobId = stub.id;
    console.log(`[Scout] Stub saved. Job UUID: ${jobId}`);

    // ── Step 4: Distill with AI (best-effort) ────────────────────────────────
    console.log(`[Scout] Fetching company intel for: ${companyName}`);
    const companyIntel = companyName !== "Unknown Company"
      ? await fetchCompanyIntel(companyName)
      : "";

    console.log(`[Scout] Distilling job post via Gemini...`);
    try {
      const distilled = await distillJobData(rawText, companyIntel);

      if (!distilled.apply_url || distilled.apply_url.length < 5) {
        distilled.apply_url = url;
      }

      // ── Step 5: Patch the stub with full AI data ─────────────────────────
      const { data: finalJob, error: patchError } = await supabaseAdmin
        .from("jobs")
        .update({
          company: distilled.company,
          role: distilled.role,
          experience_level: distilled.experience_level,
          job_type: distilled.job_type,
          pay: distilled.pay,
          remote_status: distilled.remote_status,
          location: distilled.location,
          tech_stack: distilled.tech_stack,
          match_score: distilled.match_score,
          match_explanation: distilled.match_explanation,
          missing_skills: distilled.missing_skills ?? [],
          description: distilled.description,
          responsibilities: distilled.responsibilities,
          requirements: distilled.requirements,
          apply_url: distilled.apply_url,
          posted_at: distilled.posted_at,
          apply_by: distilled.apply_by || null,
          tags: distilled.tags,
          distillation_pending: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select()
        .single();

      if (patchError) {
        console.error("[Scout] AI patch failed post-save:", patchError);
        // Still return the stub — job exists, just pending distillation
        return NextResponse.json({
          success: true,
          job: stub,
          warning: "Saved but AI distillation patch failed. Use Re-distill to retry.",
        }, { status: 201 });
      }

      console.log(`[Scout] Pipeline complete. Job ID: ${jobId}`);
      return NextResponse.json({ success: true, job: finalJob }, { status: 201 });

    } catch (aiError: any) {
      console.error("[Scout] AI distillation failed, but stub is saved:", aiError);
      // Return the stub with a warning — job is in DB with a real UUID
      return NextResponse.json({
        success: true,
        job: stub,
        warning: `AI distillation failed: ${aiError.message}. Job saved as stub. Use the ✨ Re-distill button to retry.`,
      }, { status: 201 });
    }

  } catch (error: any) {
    console.error("[Scout] Pipeline error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

