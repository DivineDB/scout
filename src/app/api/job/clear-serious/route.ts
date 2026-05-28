import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * DELETE /api/job/clear-serious
 * Deletes all jobs with status = "serious" from the database.
 */
export async function DELETE() {
  try {
    const { error, count } = await supabaseAdmin
      .from("jobs")
      .delete({ count: "exact" })
      .eq("status", "serious");

    if (error) {
      console.error("[ClearSerious] Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log(`[ClearSerious] Deleted ${count ?? 0} serious jobs.`);
    return NextResponse.json({ success: true, deleted: count ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ClearSerious] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
