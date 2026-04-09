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

    const payload = {
      profile_key: "main",
      city: body.city,
      state: body.state,
      salary_min: body.salary_min,
      salary_ideal: body.salary_ideal,
      skills: body.skills,
      updated_at: new Date().toISOString(),
    };

    console.log("[Profile] Upserting payload:", JSON.stringify(payload, null, 2));

    const { data: savedProfile, error: upsertError } = await supabase
      .from("user_profile")
      .upsert(payload, { onConflict: "profile_key" })
      .select()
      .single();

    if (upsertError) {
      console.error("[Profile] Upsert error:", JSON.stringify(upsertError));
      return NextResponse.json(
        { error: `Supabase Error: ${JSON.stringify(upsertError)}` },
        { status: 500 }
      );
    }

    console.log("[Profile] Saved successfully:", savedProfile?.id);

    // Flag all jobs as stale (match needs re-validation against new profile)
    const { error: staleError } = await supabase
      .from("jobs")
      .update({ match_stale: true, updated_at: new Date().toISOString() })
      .in("status", ["casual", "serious"]);

    if (staleError) {
      console.warn("[Profile] Failed to flag jobs as stale:", staleError.message);
    }

    // Return the saved row so the client can sync its local state
    return NextResponse.json({
      success: true,
      profile: savedProfile,
      stale_flagged: !staleError,
    });
  } catch (error: any) {
    const errorString = typeof error === 'object' ? JSON.stringify(error) : String(error);
    console.error("[Profile] Error updating profile:", errorString);
    return NextResponse.json(
      { error: `Server Error: ${errorString}` },
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
