// Audit Phase 2 — Daily DRS cron (v2)
//
// Differences from Phase 1 (../daily/route.ts):
//   - Partial-data aware: missing indicators no longer silently become 100.
//   - Bootstrap: first-ever run with no events returns DRS=100, status='bootstrap'.
//   - Retry: Supabase queries + Telegram delivery wrapped with withRetry().
//   - i18n: alert text honors ?locale=en|ko|ta (default from AUDIT_DEFAULT_LOCALE).
//
// Auth: Bearer ${CRON_SECRET}.
// Persists to the same `audit_sessions` table (db/35); writes warnings into
// a new `audit_session_warnings` JSON column if present (added in db/38, see
// Phase 2 deployment checklist) — otherwise warnings are only returned in the
// API response, not persisted, so this route is forward-compatible with both
// schemas.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  calculateDrs,
  buildAlertText,
  type IndicatorInput,
  type IndicatorKey,
  type Locale,
} from '../../../../../lib/audit/drs-calculator';
import { withRetry } from '../../../../../lib/audit/retry';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type EventType = 'backup' | 'storage' | 'integrity' | 'access';
interface EventRow {
  event_type: EventType;
  status: 'success' | 'warning' | 'failure';
  score: number | null;
}

const COLUMN_FOR: Record<EventType, IndicatorKey> = {
  backup: 'backup_recovery_rate',
  storage: 'storage_health_rate',
  integrity: 'data_integrity_rate',
  access: 'accessibility_rate',
};

function aggregate(events: EventRow[]): IndicatorInput {
  const out: IndicatorInput = {
    backup_recovery_rate: null,
    storage_health_rate: null,
    data_integrity_rate: null,
    accessibility_rate: null,
  };
  const types: EventType[] = ['backup', 'storage', 'integrity', 'access'];
  for (const t of types) {
    const filtered = events.filter((e) => e.event_type === t);
    if (filtered.length === 0) continue;
    const withScore = filtered.filter(
      (e) => typeof e.score === 'number' && e.score !== null
    );
    if (withScore.length > 0) {
      const sum = withScore.reduce((s, e) => s + (e.score as number), 0);
      out[COLUMN_FOR[t]] = Math.round(sum / withScore.length);
    } else {
      const ok = filtered.filter((e) => e.status === 'success').length;
      out[COLUMN_FOR[t]] = Math.round((ok / filtered.length) * 100);
    }
  }
  return out;
}

function kstYesterday(): { reportDate: string; startUtc: string; endUtc: string } {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const target = new Date(kstNow);
  target.setUTCDate(target.getUTCDate() - 1);
  const reportDate = target.toISOString().slice(0, 10);
  const startUtc = new Date(`${reportDate}T00:00:00+09:00`).toISOString();
  const endUtc = new Date(
    new Date(`${reportDate}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();
  return { reportDate, startUtc, endUtc };
}

async function sendTelegram(text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;
  try {
    await withRetry(async () => {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        }
      );
      if (!res.ok) {
        const err: { status: number; message: string } = {
          status: res.status,
          message: `telegram ${res.status}`,
        };
        throw err;
      }
      return true;
    });
    return true;
  } catch {
    return false;
  }
}

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

  const url = new URL(request.url);
  const locale = ((url.searchParams.get('locale') ||
    process.env.AUDIT_DEFAULT_LOCALE ||
    'en') as Locale);

  try {
    const { reportDate, startUtc, endUtc } = kstYesterday();

    // Fetch events with retry (Supabase 5xx are transient).
    const events = await withRetry(async () => {
      const { data, error } = await supabase
        .from('audit_event_logs')
        .select('event_type, status, score')
        .gte('created_at', startUtc)
        .lt('created_at', endUtc);
      if (error) {
        const err: { status: number; message: string } = {
          status: 500,
          message: error.message,
        };
        throw err;
      }
      return (data || []) as EventRow[];
    });

    // History check for bootstrap detection.
    const historyCount = await withRetry(async () => {
      const { count, error } = await supabase
        .from('audit_sessions')
        .select('*', { count: 'exact', head: true });
      if (error) {
        const err: { status: number; message: string } = {
          status: 500,
          message: error.message,
        };
        throw err;
      }
      return count ?? 0;
    });
    const hasHistory = historyCount > 0;

    const indicators = aggregate(events);
    const result = calculateDrs(indicators, { locale, hasHistory });

    // Telegram only on critical (caution = logged, not paged).
    let telegramSent = false;
    if (result.status === 'critical') {
      const text = buildAlertText(reportDate, result, locale);
      if (text) telegramSent = await sendTelegram(text);
    }

    // Persist. Use `bootstrap` → store as 'good' in the legacy column
    // (db/35 status check doesn't include 'bootstrap'); the API response
    // still carries the true status for consumers.
    const persistedStatus =
      result.status === 'bootstrap' ? 'good' : result.status;

    const session = await withRetry(async () => {
      const { data, error } = await supabase
        .from('audit_sessions')
        .upsert(
          [
            {
              report_date: reportDate,
              drs_score: result.drs_score,
              backup_recovery_rate: indicators.backup_recovery_rate,
              storage_health_rate: indicators.storage_health_rate,
              data_integrity_rate: indicators.data_integrity_rate,
              accessibility_rate: indicators.accessibility_rate,
              status: persistedStatus,
              telegram_sent: telegramSent,
              discord_sent: false,
            },
          ],
          { onConflict: 'report_date' }
        )
        .select()
        .single();
      if (error) {
        const err: { status: number; message: string } = {
          status: 500,
          message: error.message,
        };
        throw err;
      }
      return data;
    });

    return NextResponse.json({
      success: true,
      data: session,
      phase: 2,
      locale,
      event_count: events.length,
      computation: {
        drs_score: result.drs_score,
        status: result.status,
        completeness: result.completeness,
        is_partial: result.is_partial,
        is_bootstrap: result.is_bootstrap,
        used_indicators: result.used_indicators,
        missing_indicators: result.missing_indicators,
        contributions: result.contributions,
        warnings: result.warnings,
      },
    });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      {
        success: false,
        error: {
          message: e.message || (err instanceof Error ? err.message : 'Server error'),
        },
      },
      { status: e.status && e.status >= 400 ? e.status : 500 }
    );
  }
}
