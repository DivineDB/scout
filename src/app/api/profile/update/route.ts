import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey);

export interface ProfileUpdate {
  city?: string;
  state?: string;
  salary_min?: number;
  salary_ideal?: number;
  skills?: Record<string, string[]>;
  contact_email?: string;
  contact_phone?: string;
  experience_details?: Record<string, any>[];
}

/**
 * Resolve the caller's user ID from:
 *  1. Authorization: Bearer <access_token>  (preferred — set by client)
 *  2. x-user-id header                      (escape hatch for testing)
 */
async function resolveUserId(req: Request): Promise<string | null> {
  // 1. Bearer token — most reliable with @supabase/ssr clients
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user?.id) return data.user.id;
  }

  // 2. Escape hatch header
  const xUserId = req.headers.get("x-user-id");
  if (xUserId) return xUserId;
  // 3. Ultimate Fallback for Local Dev
  const { data: adminUser } = await supabaseAdmin.from('user_profile').select('id').limit(1).maybeSingle();
  if (adminUser?.id) return adminUser.id;

  // If table is completely empty, use a generated stable local ID
  return "11111111-1111-1111-1111-111111111111";
}

export async function POST(req: Request) {
  try {
    const userId = await resolveUserId(req);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ProfileUpdate = await req.json();

    const payload: Record<string, unknown> = {
      id: userId,
      city: body.city ?? null,
      state: body.state ?? null,
      salary_min: body.salary_min ?? null,
      salary_ideal: body.salary_ideal ?? null,
      updated_at: new Date().toISOString(),
    };

    // Store experience_details inside the existing skills JSONB column to avoid Postgres schema migrations
    if (body.skills || body.experience_details) {
      payload.skills = {
        ...(body.skills || {}),
        _scout_experience: body.experience_details ?? null
      };
    }

    // Only include contact fields if explicitly provided
    if (body.contact_email !== undefined) payload.contact_email = body.contact_email;
    if (body.contact_phone !== undefined) payload.contact_phone = body.contact_phone;

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

    // Flag all jobs as stale
    const { error: staleError } = await supabaseAdmin
      .from("jobs")
      .update({ match_stale: true, updated_at: new Date().toISOString() })
      .in("status", ["casual", "serious"]);

    if (staleError) {
      console.warn("[Profile] Failed to flag jobs as stale:", staleError.message);
    }

    if (savedProfile?.skills?._scout_experience) {
      savedProfile.experience_details = savedProfile.skills._scout_experience;
      delete savedProfile.skills._scout_experience;
    }

    return NextResponse.json({
      success: true,
      profile: savedProfile,
      stale_flagged: !staleError,
    });
  } catch (error: any) {
    const errorString = typeof error === "object" ? JSON.stringify(error) : String(error);
    console.error("[Profile] Error updating profile:", errorString);
    return NextResponse.json(
      { error: `Server Error: ${errorString}` },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const userId = await resolveUserId(req);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_profile")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data?.skills?._scout_experience) {
      data.experience_details = data.skills._scout_experience;
      delete data.skills._scout_experience;
    }

    return NextResponse.json({ profile: data ?? null });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ profile: null }, { status: 500 });
  }
}
