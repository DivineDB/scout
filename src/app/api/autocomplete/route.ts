import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "roles" or "locations"
    const q = searchParams.get("q") || "";

    if (!type || (type !== "roles" && type !== "locations")) {
      return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }

    if (q.trim().length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    const table = type === "roles" ? "suggested_roles" : "suggested_cities";

    const { data, error } = await supabaseAdmin
      .from(table)
      .select("name")
      .ilike("name", `%${q}%`)
      .limit(10);

    if (error) throw error;

    const suggestions = data.map((item: any) => item.name);
    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("[Autocomplete API] Error fetching suggestions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
