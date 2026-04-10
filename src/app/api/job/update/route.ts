import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Always use Service Role Key — bypasses RLS and guarantees write access
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { jobId, updates } = await req.json();

    if (!jobId || !updates) {
      return NextResponse.json({ error: "Missing jobId or updates" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("jobs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[Job Update] Supabase Error:", error);
      return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        error: `No job found with id="${jobId}". The job does not exist in the database — confirm the UUID is a real Supabase row and not a local mock.`,
        hint: "Check that the job was scouted via the Scout button (not loaded from mock_jobs.json).",
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, job: data });
  } catch (error: any) {
    console.error("[Job Update] Server Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update job" }, { status: 500 });
  }
}

