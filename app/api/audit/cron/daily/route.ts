import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type EventType = 'backup' | 'storage' | 'integrity' | 'access';

interface EventLog {
  event_type: EventType;
  status: 'success' | 'warning' | 'failure';
  score: number | null;
}

// Compute a 0-100 rate for a given event type over the day.
// Preference order: average of explicit `score` values; else success ratio.
function rateFor(events: EventLog[], type: EventType): number | null {
  const filtered = events.filter((e) => e.event_type === type);
  if (filtered.length === 0) return null;

  const withScore = filtered.filter(
    (e) => typeof e.score === 'number' && e.score !== null
  );
  if (withScore.length > 0) {
    const sum = withScore.reduce((s, e) => s + (e.score || 0), 0);
    return Math.round(sum / withScore.length);
  }

  const successCount = filtered.filter((e) => e.status === 'success').length;
  return Math.round((successCount / filtered.length) * 100);
}

function statusFromDrs(drs: number): 'good' | 'caution' | 'critical' {
  if (drs >= 95) return 'good';
  if (drs >= 85) return 'caution';
  return 'critical';
}

async function sendTelegramAlert(
  reportDate: string,
  drs: number
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;

  const text =
    `[DSC FMS Audit] CRITICAL\n` +
    `Date: ${reportDate}\n` +
    `DRS: ${drs}/100\n` +
    `Status: critical — immediate review required`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// POST /api/audit/cron/daily — compute DRS for previous calendar day (KST)
// Auth: Bearer ${CRON_SECRET}
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  try {
    // Target = the calendar day in KST that just ended.
    // Cron runs 03:30 KST → target = today (KST) minus 0; we use yesterday for safety
    // so the full 24h window is closed.
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const target = new Date(kstNow);
    target.setUTCDate(target.getUTCDate() - 1);
    const reportDate = target.toISOString().slice(0, 10);

    // Window: [reportDate 00:00 KST, reportDate+1 00:00 KST) → in UTC:
    //   start = reportDate 00:00 KST = reportDate-1 15:00 UTC
    //   end   = reportDate 24:00 KST = reportDate     15:00 UTC
    const startUtc = new Date(`${reportDate}T00:00:00+09:00`).toISOString();
    const endUtc = new Date(
      new Date(`${reportDate}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: events, error: evErr } = await supabase
      .from('audit_event_logs')
      .select('event_type, status, score')
      .gte('created_at', startUtc)
      .lt('created_at', endUtc);

    if (evErr) {
      return NextResponse.json(
        { success: false, error: { message: evErr.message } },
        { status: 500 }
      );
    }

    const eventList = (events || []) as EventLog[];

    const backup = rateFor(eventList, 'backup');
    const storage = rateFor(eventList, 'storage');
    const integrity = rateFor(eventList, 'integrity');
    const access = rateFor(eventList, 'access');

    // Default to 100 for missing categories (no signals = no degradation).
    const b = backup ?? 100;
    const s = storage ?? 100;
    const i = integrity ?? 100;
    const a = access ?? 100;

    const drs = Math.round(b * 0.4 + s * 0.3 + i * 0.2 + a * 0.1);
    const status = statusFromDrs(drs);

    let telegramSent = false;
    if (status === 'critical') {
      telegramSent = await sendTelegramAlert(reportDate, drs);
    }

    const { data: session, error: upErr } = await supabase
      .from('audit_sessions')
      .upsert(
        [
          {
            report_date: reportDate,
            drs_score: drs,
            backup_recovery_rate: backup,
            storage_health_rate: storage,
            data_integrity_rate: integrity,
            accessibility_rate: access,
            status,
            telegram_sent: telegramSent,
            discord_sent: false,
          },
        ],
        { onConflict: 'report_date' }
      )
      .select()
      .single();

    if (upErr) {
      return NextResponse.json(
        { success: false, error: { message: upErr.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
      event_count: eventList.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error ? err.message : 'Server error',
        },
      },
      { status: 500 }
    );
  }
}
