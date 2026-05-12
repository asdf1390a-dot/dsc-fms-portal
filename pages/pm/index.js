import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Filter tab labels ─────────────────────────────────────────────────
// all   : 기본 뷰. 오늘 기준 D-3 ~ D+3 범위만 (pending) + 같은 범위의 completed
// week  : 이번 주(월~일) 예정(pending)
// severe: 3일 이상 지연된 항목 (D+3 초과, pending)
// completed: 완료된 전체
const TAB_LABELS = {
  all: '전체',
  week: '이번주',
  severe: 'D+3 초과',
  completed: '완료',
};
const FILTER_ORDER = ['all', 'week', 'severe', 'completed'];

// ── Status colors (left bar) ──────────────────────────────────────────
// 예정(파랑은 너무 평범) → 임박/지연/완료 구분을 우선시
//   초록 = 예정 (정상), 주황 = 임박/오늘, 빨강 = 지연, 회색 = 완료/스킵
const BAR_COLOR = {
  scheduled:  '#22c55e', // 정상 예정 (D-4 이상)
  upcoming:   '#f59e0b', // 임박 (D-3 ~ D-1)
  today:      '#f97316', // 오늘
  overdue:    '#ef4444', // 지연
  completed:  '#64748b', // 완료
  skipped:    '#475569',
};

// ── D-day 계산 (모든 라벨/색상은 여기서 단일 결정) ────────────────────
function getDday(scheduledDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sched = new Date(scheduledDateStr);
  sched.setHours(0, 0, 0, 0);
  const diff = Math.round((sched - today) / 86400000);

  if (diff > 0) {
    return {
      diff,
      text: `D-${diff}일`,
      color: '#60a5fa',
      bg: 'rgba(37,99,235,0.18)',
    };
  }
  if (diff === 0) {
    return {
      diff: 0,
      text: '오늘',
      color: '#fb923c',
      bg: 'rgba(249,115,22,0.2)',
    };
  }
  return {
    diff,
    text: `D+${Math.abs(diff)}일`,
    color: '#f87171',
    bg: 'rgba(220,38,38,0.2)',
  };
}

// ── 상태/D-day 기반 좌측 컬러바 결정 ─────────────────────────────────
function getBarColor(status, diff) {
  if (status === 'completed') return BAR_COLOR.completed;
  if (status === 'skipped')   return BAR_COLOR.skipped;
  // pending / in_progress 는 D-day 기반
  if (diff < 0)  return BAR_COLOR.overdue;
  if (diff === 0) return BAR_COLOR.today;
  if (diff <= 3)  return BAR_COLOR.upcoming;
  return BAR_COLOR.scheduled;
}

// ── 이번 주(월~일) 범위 계산 ─────────────────────────────────────────
function getWeekRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // getDay(): 일=0, 월=1, ..., 토=6
  const dow = today.getDay();
  // 월요일까지 거슬러 가는 일수 (일요일이면 -6, 월요일이면 0)
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today.getTime() + toMonday * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return { monday, sunday };
}

export default function PMIndexPage() {
  useAuth(); // session bootstrap (not gated — list is readable by anon)

  const [schedules, setSchedules] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  // ── Fetch compliance ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pm/compliance');
        const json = await res.json();
        if (res.ok) setCompliance(json.monthly || null);
      } catch (_) {}
    })();
  }, []);

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
    const dayMs = 86400000;
    const minus3 = new Date(today.getTime() - 3 * dayMs);
    const plus3  = new Date(today.getTime() + 3 * dayMs);
    const { monday, sunday } = getWeekRange();

    return schedules.filter(s => {
      const d = new Date(s.scheduled_date);
      d.setHours(0, 0, 0, 0);

      if (filter === 'all') {
        // 완료 항목은 기본 뷰에서 제외 (잡음 방지). pending/in_progress 중 D-3 ~ D+3 범위만.
        if (s.status === 'completed' || s.status === 'skipped') return false;
        return d >= minus3 && d <= plus3;
      }
      if (filter === 'completed') return s.status === 'completed';
      if (filter === 'week') {
        if (s.status !== 'pending' && s.status !== 'in_progress') return false;
        return d >= monday && d <= sunday;
      }
      if (filter === 'severe') {
        // D+3 초과 = 4일 이상 지연
        if (s.status !== 'pending' && s.status !== 'in_progress') return false;
        const diffDays = Math.round((d - today) / dayMs);
        return diffDays <= -4;
      }
      return true;
    });
  }, [schedules, filter]);

  // ── Counts per tab ──────────────────────────────────────────────────
  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 86400000;
    const minus3 = new Date(today.getTime() - 3 * dayMs);
    const plus3  = new Date(today.getTime() + 3 * dayMs);
    const { monday, sunday } = getWeekRange();

    const c = { all: 0, week: 0, severe: 0, completed: 0 };
    for (const s of schedules) {
      const d = new Date(s.scheduled_date);
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.round((d - today) / dayMs);
      const isOpen = s.status === 'pending' || s.status === 'in_progress';

      if (s.status === 'completed') c.completed++;
      if (isOpen && d >= minus3 && d <= plus3) c.all++;
      if (isOpen && d >= monday && d <= sunday) c.week++;
      if (isOpen && diffDays <= -4) c.severe++;
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

        {compliance && (
          <div style={S.complianceCard}>
            <div style={S.complianceLabel}>이번 달 PM 이행률</div>
            <div style={S.complianceRow}>
              <div style={{ ...S.complianceBig, color: complianceColor(compliance.compliance_rate) }}>
                {compliance.compliance_rate != null ? `${compliance.compliance_rate}%` : '—'}
              </div>
              <div style={S.complianceSub}>
                <div>완료 <strong style={{ color: '#86efac' }}>{compliance.total_completed}</strong> / {compliance.total_scheduled}건</div>
                {compliance.total_overdue > 0 && (
                  <div style={{ color: '#fca5a5' }}>지연 <strong>{compliance.total_overdue}</strong>건</div>
                )}
              </div>
            </div>
          </div>
        )}

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

        {filter === 'all' && (
          <div style={S.hint}>오늘 기준 D-3 ~ D+3 범위만 표시. 지연 4일 이상은 “D+3 초과” 탭에서 확인.</div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            {filter === 'all'
              ? '이번 주변(D-3 ~ D+3)에 예정된 PM이 없습니다.'
              : '해당 조건의 일정이 없습니다.'}
          </div>
        ) : (
          <ul style={S.list}>
            {filtered.map(s => {
              const dd = getDday(s.scheduled_date);
              const barColor = getBarColor(s.status, dd.diff);
              const plan = s.pm_plans || {};
              const asset = s.assets || {};
              const isCompleted = s.status === 'completed';
              return (
                <li key={s.id} style={S.card}>
                  <span style={{ ...S.statusBar, background: barColor }} />
                  <Link href={`/pm/${s.id}`} style={S.cardLink}>
                    <div style={S.cardTop}>
                      <span style={{
                        ...S.ddayBadge,
                        color: isCompleted ? '#94a3b8' : dd.color,
                        background: isCompleted ? 'rgba(100,116,139,0.2)' : dd.bg,
                      }}>
                        {isCompleted ? '완료' : dd.text}
                      </span>
                      <span style={S.schedDate}>{s.scheduled_date}</span>
                    </div>
                    <div style={S.taskTitle}>{plan.title || '(작업명 없음)'}</div>
                    <div style={S.assetLine}>
                      <span style={S.assetTag}>{asset.machine_asset_number || '—'}</span>
                      {asset.name_en ? <span style={S.assetName}> · {asset.name_en}</span> : null}
                    </div>
                    <div style={S.meta}>
                      <span style={S.metaItem} aria-label="주기">
                        <span style={S.metaIcon} aria-hidden="true">🔄</span>
                        {plan.frequency_days ? `${plan.frequency_days}일` : '—'}
                      </span>
                      {plan.estimated_hours ? (
                        <span style={S.metaItem} aria-label="예상시간">
                          <span style={S.metaIcon} aria-hidden="true">⏱</span>
                          {plan.estimated_hours}h
                        </span>
                      ) : null}
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
  hint: { fontSize: 11, color: '#64748b', padding: '8px 14px 0', lineHeight: 1.45 },
  list: { listStyle: 'none', margin: 0, padding: '8px 14px 16px' },
  card: { position: 'relative', background: '#1e293b', borderRadius: 12, marginBottom: 10, overflow: 'hidden', border: '1px solid #1f2937', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  statusBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardLink: { display: 'block', padding: '12px 14px 12px 18px', textDecoration: 'none', color: 'inherit' },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  ddayBadge: { fontSize: 12, fontWeight: 800, padding: '4px 9px', borderRadius: 6, fontFamily: 'ui-monospace,Menlo,monospace', letterSpacing: 0.2 },
  schedDate: { fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  taskTitle: { fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 4, lineHeight: 1.35 },
  assetLine: { fontSize: 12, marginBottom: 8, lineHeight: 1.35 },
  assetTag: { color: '#cbd5e1', fontWeight: 600, fontFamily: 'ui-monospace,Menlo,monospace' },
  assetName: { color: '#64748b' },
  meta: { fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 12, lineHeight: 1 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  complianceCard: { margin: '12px 14px 4px', padding: 14, background: '#1e293b', borderRadius: 12, border: '1px solid #1f2937' },
  complianceLabel: { fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  complianceRow: { display: 'flex', alignItems: 'center', gap: 14 },
  complianceBig: { fontSize: 32, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,monospace', lineHeight: 1, minWidth: 90 },
  complianceSub: { fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 },
};

function complianceColor(rate) {
  if (rate == null) return '#94a3b8';
  if (rate >= 95) return '#86efac';
  if (rate >= 80) return '#fcd34d';
  return '#fca5a5';
}
