import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Filter tab labels ─────────────────────────────────────────────────
const TAB_LABELS = {
  all: '전체',
  week: '이번주',
  overdue: '지연',
  completed: '완료',
};
const FILTER_ORDER = ['all', 'week', 'overdue', 'completed'];

// ── Status colors (left bar) ──────────────────────────────────────────
const STATUS_COLOR = {
  pending:     '#2563eb',
  in_progress: '#f97316',
  completed:   '#16a34a',
  skipped:     '#64748b',
};

// ── D-day calculation ─────────────────────────────────────────────────
function getDday(scheduledDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sched = new Date(scheduledDateStr);
  const diff = Math.round((sched - today) / 86400000);
  if (diff > 0) return { text: `D-${diff}`, color: '#60a5fa', bg: 'rgba(37,99,235,0.2)' };
  if (diff === 0) return { text: 'D-DAY', color: '#fbbf24', bg: 'rgba(234,179,8,0.2)' };
  return { text: `D+${Math.abs(diff)}`, color: '#f87171', bg: 'rgba(220,38,38,0.2)' };
}

export default function PMIndexPage() {
  useAuth(); // session bootstrap (not gated — list is readable by anon)

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  // ── Fetch on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('pm_schedules')
        .select(`
          id, scheduled_date, status, created_at,
          pm_plans(id, title, frequency_days, estimated_hours),
          assets(machine_asset_number, name_en)
        `)
        .order('scheduled_date', { ascending: true })
        .limit(100);
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
      } else {
        setSchedules(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Filtering ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today.getTime() + 7 * 86400000);

    return schedules.filter(s => {
      if (filter === 'all') return true;
      if (filter === 'completed') return s.status === 'completed';
      if (filter === 'week') {
        if (s.status !== 'pending') return false;
        const d = new Date(s.scheduled_date);
        return d >= today && d <= weekAhead;
      }
      if (filter === 'overdue') {
        if (s.status !== 'pending') return false;
        return new Date(s.scheduled_date) < today;
      }
      return true;
    });
  }, [schedules, filter]);

  // ── Counts per tab ──────────────────────────────────────────────────
  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today.getTime() + 7 * 86400000);

    const c = { all: schedules.length, week: 0, overdue: 0, completed: 0 };
    for (const s of schedules) {
      if (s.status === 'completed') c.completed++;
      if (s.status === 'pending') {
        const d = new Date(s.scheduled_date);
        if (d >= today && d <= weekAhead) c.week++;
        if (d < today) c.overdue++;
      }
    }
    return c;
  }, [schedules]);

  return (
    <>
      <Head>
        <title>PM 일정 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <h1 style={S.title}>PM 일정</h1>
          <Link href="/pm/new" style={S.fab} aria-label="새 PM 계획">+</Link>
        </header>

        <div style={S.tabBar}>
          {FILTER_ORDER.map(key => {
            const active = filter === key;
            const count = counts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={{
                  ...S.tab,
                  borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  color: active ? '#f8fafc' : '#94a3b8',
                }}
                aria-pressed={active}
              >
                <span style={S.tabLabel}>{TAB_LABELS[key]}</span>
                <span style={{
                  ...S.tabCount,
                  background: active ? 'rgba(37,99,235,0.25)' : 'rgba(100,116,139,0.2)',
                  color: active ? '#93c5fd' : '#94a3b8',
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            {filter === 'all' ? 'PM 일정이 없습니다. + 버튼으로 새 계획을 등록하세요.' : '해당 조건의 일정이 없습니다.'}
          </div>
        ) : (
          <ul style={S.list}>
            {filtered.map(s => {
              const dd = getDday(s.scheduled_date);
              const barColor = STATUS_COLOR[s.status] || '#64748b';
              const plan = s.pm_plans || {};
              const asset = s.assets || {};
              return (
                <li key={s.id} style={S.card}>
                  <span style={{ ...S.statusBar, background: barColor }} />
                  <Link href={`/pm/${s.id}`} style={S.cardLink}>
                    <div style={S.cardTop}>
                      <span style={{ ...S.ddayBadge, color: dd.color, background: dd.bg }}>
                        {dd.text}
                      </span>
                      <span style={S.schedDate}>{s.scheduled_date}</span>
                    </div>
                    <div style={S.assetLine}>
                      <span style={S.assetTag}>{asset.machine_asset_number || '—'}</span>
                      {asset.name_en ? <span style={{ color: '#94a3b8' }}> · {asset.name_en}</span> : null}
                    </div>
                    <div style={S.taskTitle}>{plan.title || '(작업명 없음)'}</div>
                    <div style={S.meta}>
                      주기 {plan.frequency_days || '—'}일
                      {plan.estimated_hours ? ` · 예상 ${plan.estimated_hours}h` : ''}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' },
  fab: { width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 300, boxShadow: '0 4px 12px rgba(37,99,235,0.5)' },
  tabBar: { position: 'sticky', top: 65, zIndex: 15, background: '#0f172a', borderBottom: '1px solid #1f2937', display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
  tab: { flex: '1 0 auto', background: 'transparent', border: 'none', padding: '12px 8px 14px', cursor: 'pointer', minHeight: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 12, fontWeight: 700 },
  tabCount: { fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 999 },
  list: { listStyle: 'none', margin: 0, padding: '8px 14px 16px' },
  card: { position: 'relative', background: '#1e293b', borderRadius: 12, marginBottom: 10, overflow: 'hidden', border: '1px solid #1f2937', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  statusBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardLink: { display: 'block', padding: '12px 14px 12px 18px', textDecoration: 'none', color: 'inherit' },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  ddayBadge: { fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 6, fontFamily: 'ui-monospace,Menlo,monospace' },
  schedDate: { fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  assetLine: { fontSize: 14, marginBottom: 4 },
  assetTag: { color: '#f8fafc', fontWeight: 700, fontFamily: 'ui-monospace,Menlo,monospace' },
  taskTitle: { fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 },
  meta: { fontSize: 11, color: '#64748b' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
};
