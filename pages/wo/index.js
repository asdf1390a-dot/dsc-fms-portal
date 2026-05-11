import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Filter tabs ─────────────────────────────────────────────────────
const TAB_LABELS = {
  all:         '전체',
  in_progress: '진행중',
  open:        '미완료',
  completed:   '완료',
};
const FILTER_ORDER = ['all', 'in_progress', 'open', 'completed'];

// ── Priority colors (left bar) ──────────────────────────────────────
const PRIORITY_COLOR = {
  critical: '#dc2626', // red
  high:     '#f97316', // orange
  medium:   '#2563eb', // blue
  low:      '#64748b', // gray
};

const PRIORITY_LABEL = {
  critical: '긴급',
  high:     '높음',
  medium:   '보통',
  low:      '낮음',
};

const STATUS_META = {
  open:           { label: '대기',   fg: '#93c5fd', bg: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.6)' },
  in_progress:    { label: '진행중', fg: '#fdba74', bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.6)' },
  pending_parts:  { label: '부품대기', fg: '#fcd34d', bg: 'rgba(234,179,8,0.18)',  border: 'rgba(234,179,8,0.6)' },
  completed:      { label: '완료',   fg: '#86efac', bg: 'rgba(34,197,94,0.18)',  border: 'rgba(34,197,94,0.6)' },
  cancelled:      { label: '취소',   fg: '#94a3b8', bg: 'rgba(100,116,139,0.2)', border: 'rgba(100,116,139,0.5)' },
};

// ── D-day calculation (returns null if no due_date) ─────────────────
function getDday(dueDateStr) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) {
    return { text: `D+${Math.abs(diff)}`, color: '#f87171', bg: 'rgba(220,38,38,0.2)' };
  }
  if (diff === 0) {
    return { text: 'D-DAY', color: '#fbbf24', bg: 'rgba(234,179,8,0.2)' };
  }
  if (diff <= 3) {
    return { text: `D-${diff}`, color: '#fb923c', bg: 'rgba(249,115,22,0.2)' };
  }
  return { text: `D-${diff}`, color: '#60a5fa', bg: 'rgba(37,99,235,0.2)' };
}

export default function WorkOrderIndexPage() {
  useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  // ── Fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('work_orders')
        .select('*, assets(machine_asset_number, name_en)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Filtering ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filter === 'all') return true;
      if (filter === 'completed') return o.status === 'completed';
      if (filter === 'in_progress') return o.status === 'in_progress';
      if (filter === 'open') {
        // "미완료" = open + pending_parts (전체 미완료 작업)
        return o.status === 'open' || o.status === 'pending_parts';
      }
      return true;
    });
  }, [orders, filter]);

  // ── Counts ───────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { all: orders.length, in_progress: 0, open: 0, completed: 0 };
    for (const o of orders) {
      if (o.status === 'in_progress') c.in_progress++;
      if (o.status === 'open' || o.status === 'pending_parts') c.open++;
      if (o.status === 'completed') c.completed++;
    }
    return c;
  }, [orders]);

  return (
    <>
      <Head>
        <title>작업지시 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <h1 style={S.title}>작업지시</h1>
          <Link href="/wo/new" style={S.fab} aria-label="새 작업지시">+</Link>
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
            {filter === 'all' ? '작업지시가 없습니다. + 버튼으로 새 작업을 등록하세요.' : '해당 조건의 작업이 없습니다.'}
          </div>
        ) : (
          <ul style={S.list}>
            {filtered.map(o => {
              const dd = getDday(o.due_date);
              const barColor = PRIORITY_COLOR[o.priority] || '#64748b';
              const statusMeta = STATUS_META[o.status] || STATUS_META.open;
              const asset = o.assets || null;
              return (
                <li key={o.id} style={S.card}>
                  <span style={{ ...S.priorityBar, background: barColor }} />
                  <Link href={`/wo/${o.id}`} style={S.cardLink}>
                    <div style={S.cardTop}>
                      <span style={S.woNumber}>{o.wo_number || '—'}</span>
                      {dd && (
                        <span style={{ ...S.ddayBadge, color: dd.color, background: dd.bg }}>
                          {dd.text}
                        </span>
                      )}
                    </div>
                    <div style={S.taskTitle}>{o.title}</div>
                    <div style={S.statusRow}>
                      <span style={{ ...S.statusPill, color: statusMeta.fg, background: statusMeta.bg, border: `1px solid ${statusMeta.border}` }}>
                        {statusMeta.label}
                      </span>
                      <span style={S.priorityChip}>
                        {PRIORITY_LABEL[o.priority] || o.priority}
                      </span>
                      {o.assigned_to && (
                        <span style={S.assignee}>· {o.assigned_to}</span>
                      )}
                    </div>
                    {asset && (
                      <div style={S.assetLine}>
                        <span style={S.assetTag}>{asset.machine_asset_number || '—'}</span>
                        {asset.name_en && <span style={{ color: '#94a3b8' }}> · {asset.name_en}</span>}
                      </div>
                    )}
                    {o.due_date && (
                      <div style={S.dueMeta}>기한 {o.due_date}</div>
                    )}
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

// ── Styles ──────────────────────────────────────────────────────────
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
  priorityBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardLink: { display: 'block', padding: '12px 14px 12px 18px', textDecoration: 'none', color: 'inherit' },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  woNumber: { fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace', fontWeight: 600 },
  ddayBadge: { fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 6, fontFamily: 'ui-monospace,Menlo,monospace' },
  taskTitle: { fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 8, lineHeight: 1.35 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  statusPill: { fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999 },
  priorityChip: { fontSize: 11, fontWeight: 700, color: '#cbd5e1' },
  assignee: { fontSize: 12, color: '#94a3b8' },
  assetLine: { fontSize: 13, marginBottom: 4 },
  assetTag: { color: '#e2e8f0', fontWeight: 700, fontFamily: 'ui-monospace,Menlo,monospace' },
  dueMeta: { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace,Menlo,monospace' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
};
