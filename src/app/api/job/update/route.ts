import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
      .single();

    if (error) {
      console.error("[Job Update] Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, job: data });
  } catch (error: any) {
    console.error("[Job Update] Server Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update job" }, { status: 500 });
  }
}
