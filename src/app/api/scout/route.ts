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
    
    // 1. Scrape the URL
    const rawText = await fetchJobPage(url);
    if (!rawText) {
       return NextResponse.json({ error: "Failed to extract text from URL." }, { status: 400 });
    }

    // 2. Identify Company early to fetch intel
    console.log(`[Scout] Extracting company name...`);
    const companyResponse = await ai.models.generateContent({
      model: "gemini-3.0-flash",
      contents: `Extract the primary company name hiring for this job from the raw text. Return ONLY the company name as a string, nothing else.\n\nText: ${rawText}`
    });
    const companyName = companyResponse.text?.trim() || "Unknown Company";

    // 3. Fetch Company Intel (AmbitionBox, Glassdoor, etc.)
    console.log(`[Scout] Fetching intel for: ${companyName}`);
    const companyIntel = companyName !== "Unknown Company" ? await fetchCompanyIntel(companyName) : "";

    // 4. Distill using Gemini
    console.log(`[Scout] Distilling job post...`);
    const distilled = await distillJobData(rawText, companyIntel);

    // Override the apply URL if not found or just to be safe
    if (!distilled.apply_url || distilled.apply_url.length < 5) {
      distilled.apply_url = url;
    }

    // 5. Save to Supabase DB
    console.log(`[Scout] Saving to database...`);
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .insert({
        company: distilled.company,
        role: distilled.role,
        experience_level: distilled.experience_level,
        job_type: distilled.job_type,
        pay: distilled.pay,
        remote_status: distilled.remote_status,
        location: distilled.location,
        tech_stack: distilled.tech_stack,
        match_score: distilled.match_score,
        description: distilled.description,
        responsibilities: distilled.responsibilities,
        requirements: distilled.requirements,
        apply_url: distilled.apply_url,
        posted_at: distilled.posted_at,
        apply_by: distilled.apply_by || null,
        is_active: true,
        tags: distilled.tags,
        status: "casual"
      })
      .select()
      .single();

    if (error) {
      console.error("[Scout] DB Error:", error);
      return NextResponse.json({ error: "Failed to save to database", details: error }, { status: 500 });
    }

    console.log(`[Scout] Pipeline complete. Job ID: ${data?.id}`);
    return NextResponse.json({ success: true, job: data }, { status: 201 });

  } catch (error: any) {
    console.error("[Scout] Pipeline error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
