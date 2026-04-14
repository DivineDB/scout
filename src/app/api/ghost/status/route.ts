import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export interface GhostStatus {
  last_ran_at: string | null;
  jobs_saved: number;
  high_matches: number;
  status: 'success' | 'failed' | 'never';
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('ghost_sweeps')
      .select('ran_at, jobs_saved, high_matches, status')
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json<GhostStatus>({
        last_ran_at: null,
        jobs_saved: 0,
        high_matches: 0,
        status: 'never',
      });
    }

    return NextResponse.json<GhostStatus>({
      last_ran_at: data.ran_at,
      jobs_saved: data.jobs_saved ?? 0,
      high_matches: data.high_matches ?? 0,
      status: (data.status as GhostStatus['status']) ?? 'success',
    });
  } catch (err) {
    console.error('[Ghost Status]', err);
    return NextResponse.json<GhostStatus>({
      last_ran_at: null,
      jobs_saved: 0,
      high_matches: 0,
      status: 'never',
    });
  }
}
