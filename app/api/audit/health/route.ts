// Audit Phase 2 — health probe.
// Verifies: env wiring, Supabase reachability, latest session age.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, unknown> = {};

  checks.env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
    AUDIT_DEFAULT_LOCALE: process.env.AUDIT_DEFAULT_LOCALE || 'en',
  };

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data, error } = await sb
      .from('audit_sessions')
      .select('report_date, drs_score, status')
      .order('report_date', { ascending: false })
      .limit(1);
    if (error) {
      checks.supabase = { ok: false, error: error.message };
    } else {
      const latest = data?.[0];
      const ageDays = latest
        ? Math.floor(
            (Date.now() - new Date(`${latest.report_date}T00:00:00+09:00`).getTime()) /
              86_400_000
          )
        : null;
      checks.supabase = { ok: true, latest, age_days: ageDays };
    }
  } catch (err) {
    checks.supabase = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json({ success: true, phase: 2, checks });
}
