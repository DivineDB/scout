import { NextResponse } from "next/server";
import { conductGlobalSweep } from "@/lib/ghost";

export const dynamic = "force-dynamic";

/**
 * POST /api/ghost/trigger
 * Manually triggers a Ghost Scout sweep in the background (fire-and-forget).
 * Retained for backward compatibility.
 */
export async function POST() {
  conductGlobalSweep().catch((err) => {
    console.error("[Ghost Trigger] Background sweep error:", err);
  });

  return NextResponse.json({
    success: true,
    message: "Ghost Scout sweep started. New jobs will appear in Casual Hunt shortly.",
  });
}

/**
 * GET /api/ghost/trigger
 * Establishes a Server-Sent Events (SSE) stream to provide real-time
 * progress percentage and status logs for the sweep.
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (progress: number, message: string) => {
        try {
          const payload = JSON.stringify({ progress, message });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch (err) {
          console.error("[Ghost Trigger SSE] Fail to enqueue payload:", err);
        }
      };

      try {
        await conductGlobalSweep((progress, message) => {
          sendEvent(progress, message);
        });
      } catch (err: any) {
        console.error("[Ghost Trigger SSE] Sweep execution error:", err);
        sendEvent(100, `Sweep aborted: ${err.message || err}`);
      } finally {
        try {
          controller.close();
        } catch {
          // Stream might have already been closed by client abort
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
