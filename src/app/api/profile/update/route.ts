import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Always use the Service Role Key — guarantees the upsert bypasses RLS even
// if the session cookie is missing or stale.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey);

export interface ProfileUpdate {
  city?: string;
  state?: string;
  salary_min?: number;
  salary_ideal?: number;
  skills?: Record<string, string[]>;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseSession = createClient(cookieStore);
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ProfileUpdate = await req.json();

    // ── Payload matches user_profile schema exactly (no profile_key) ──────────
    const payload = {
      id: user.id,
      city: body.city ?? null,
      state: body.state ?? null,
      salary_min: body.salary_min ?? null,
      salary_ideal: body.salary_ideal ?? null,
      skills: body.skills ?? null,
      updated_at: new Date().toISOString(),
    };

    console.log("[Profile] Upserting payload:", JSON.stringify(payload, null, 2));

    const { data: savedProfile, error: upsertError } = await supabaseAdmin
      .from("user_profile")
      .upsert(payload, { onConflict: "id" })
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
    const { error: staleError } = await supabaseAdmin
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
    const cookieStore = await cookies();
    const supabaseSession = createClient(cookieStore);
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_profile")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    return NextResponse.json({ profile: data ?? null });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ profile: null }, { status: 500 });
  }
}
