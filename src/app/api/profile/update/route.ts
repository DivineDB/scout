import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface ProfileUpdate {
  city?: string;
  state?: string;
  salary_min?: number;
  salary_ideal?: number;
  skills?: Record<string, string[]>;
}

export async function POST(req: Request) {
  try {
    const body: ProfileUpdate = await req.json();

    // Upsert into user_profile using fixed 'main' key
    const { error: upsertError } = await supabase
      .from("user_profile")
      .upsert(
        {
          profile_key: "main",
          city: body.city,
          state: body.state,
          salary_min: body.salary_min,
          salary_ideal: body.salary_ideal,
          skills: body.skills,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_key" }
      );

    if (upsertError) throw upsertError;

    // Flag all serious + casual jobs as stale (match needs re-validation)
    const { error: staleError } = await supabase
      .from("jobs")
      .update({ match_stale: true, updated_at: new Date().toISOString() })
      .in("status", ["casual", "serious"]);

    if (staleError) {
      // Non-fatal: log but don't fail the request
      console.warn("Failed to flag jobs as stale:", staleError.message);
    }

    return NextResponse.json({ success: true, stale_flagged: !staleError });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("user_profile")
      .select("*")
      .eq("profile_key", "main")
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    return NextResponse.json({ profile: data ?? null });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ profile: null }, { status: 500 });
  }
}
