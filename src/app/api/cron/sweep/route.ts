import { NextResponse } from 'next/server';
import { conductGlobalSweep } from '@/lib/ghost';

/**
 * Protected cron trigger for the Ghost Sweep.
 * Called manually or by an external scheduler (e.g. cURL from GitHub Actions).
 * Protect with CRON_SECRET env var.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';

  // This ensures ONLY Vercel or someone with your secret can run the Ghost
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await conductGlobalSweep();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Cron] Sweep error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow Vercel cron to invoke this via POST too
export const POST = GET;
