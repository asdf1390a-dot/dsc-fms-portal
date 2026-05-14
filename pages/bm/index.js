import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Priority → left-bar colour (4px edge accent on each card) ────────
// `priority` column is populated by /bm/new (low|medium|high|critical).
// Fallback to severity if priority is null on legacy rows.
const PRIORITY_BAR = {
  critical: '#dc2626',
  high:     '#f97316',
  medium:   '#2563eb',
  low:      '#64748b',
};
const SEVERITY_TO_PRIORITY = {
  line_down: 'critical',
  major:     'high',
  normal:    'medium',
  minor:     'low',
};

// ── Severity pill (dark theme) ───────────────────────────────────────
const SEVERITY_PILL = {
  line_down: { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)',  label: '라인다운' },
  major:     { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)', label: '주요' },
  normal:    { bg: 'rgba(37,99,235,0.18)',  fg: '#93c5fd', border: 'rgba(37,99,235,0.6)',  label: '정상' },
  minor:     { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)', label: '경미' },
};

// ── Status pill (dark theme) ─────────────────────────────────────────
const STATUS_PILL = {
  open:          { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)',  label: '접수' },
  in_progress:   { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)', label: '진행중' },
  pending_parts: { bg: 'rgba(234,179,8,0.18)',  fg: '#fde68a', border: 'rgba(234,179,8,0.6)',  label: '부품대기' },
  resolved:      { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)',  label: '완료' },
  wontfix:       { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)', label: '미처리' },
};

// ── Filter tabs ──────────────────────────────────────────────────────
const FILTERS = [
  { key: 'open',        label: '접수' },
  { key: 'in_progress', label: '진행중' },
  { key: 'all',         label: '전체' },
  { key: 'resolved',    label: '완료' },
];

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60)    return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60)    return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24)    return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7)     return `${d}일 전`;
  const w = Math.floor(d / 7);
  if (w < 5)     return `${w}주 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BMListPage() {
  const { isAuthed, employeeId, fullName, signOut } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('bm_events')
        .select('id, asset_id, reported_at, reporter_name, severity, priority, symptom, status, resolved_at, assets(machine_asset_number, name_en, location)')
        .order('reported_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      setEvents(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  // ── Counts per tab ───────────────────────────────────────────────
  const counts = useMemo(() => ({
    open:        events.filter(e => e.status === 'open').length,
    in_progress: events.filter(e => e.status === 'in_progress' || e.status === 'pending_parts').length,
    all:         events.length,
    resolved:    events.filter(e => e.status === 'resolved').length,
  }), [events]);

  // ── Filtered list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return events.filter(e => {
      if (filter === 'open' && e.status !== 'open') return false;
      if (filter === 'in_progress' && e.status !== 'in_progress' && e.status !== 'pending_parts') return false;
      if (filter === 'resolved' && e.status !== 'resolved') return false;
      // 'all' passes through
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          e.symptom,
          e.assets?.machine_asset_number,
          e.assets?.name_en,
          e.assets?.location,
          e.reporter_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, filter, search]);

  return (
    <>
      <Head>
        <title>BM 이력 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        {/* ── Sticky header ───────────────────────────────────────── */}
        <header style={S.header}>
          <Link href="/" style={S.backLink} aria-label="홈">← 홈</Link>
          <h1 style={S.title}>BM 이력</h1>
          <div style={S.headerRight}>
            {isAuthed ? (
              <button onClick={signOut} style={S.userChip} title={fullName || '로그인됨'}>
                {employeeId || '✓'}
              </button>
            ) : (
              <Link href="/login" style={S.loginLink}>로그인</Link>
            )}
            {/* Menu button */}
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={S.menuBtn}
                title="더 보기"
                aria-label="메뉴"
              >
                ⋮
              </button>
              {showMenu && (
                <div style={S.dropdown}>
                  <Link href="/bm/new" style={S.dropdownItem}>
                    + 신규 고장 신고
                  </Link>
                  <Link href="/bm/import" style={S.dropdownItem}>
                    📥 Excel 임포트
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Sticky filter tabs ─────────────────────────────────── */}
        <div style={S.tabBar}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  ...S.tab,
                  ...(active ? S.tabActive : null),
                }}
              >
                <span style={{ ...S.tabLabel, color: active ? '#fff' : '#94a3b8' }}>
                  {f.label}
                </span>
                <span style={{
                  ...S.tabCount,
                  background: active ? '#dc2626' : '#1f2937',
                  color: active ? '#fff' : '#94a3b8',
                }}>
                  {counts[f.key]}
                </span>
                {active && <span style={S.tabUnderline} />}
              </button>
            );
          })}
        </div>

        {/* ── Search bar ─────────────────────────────────────────── */}
        <div style={S.searchWrap}>
          <span style={S.searchIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="자산번호 / 증상 검색…"
            style={S.search}
            inputMode="search"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={S.searchClear}
              aria-label="검색 초기화"
            >×</button>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        {error && (
          <div style={S.errorBox}>
            {error}
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
              Supabase에서 `05_bm_schema.sql`을 실행했나요?
            </div>
          </div>
        )}

        {loading && <div style={S.loading}>불러오는 중…</div>}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState filter={filter} isAuthed={isAuthed} />
        )}

        {!loading && filtered.length > 0 && (
          <ul style={S.list}>
            {filtered.map(e => {
              const sev = SEVERITY_PILL[e.severity] || SEVERITY_PILL.normal;
              const st  = STATUS_PILL[e.status]     || STATUS_PILL.open;
              const prKey = e.priority || SEVERITY_TO_PRIORITY[e.severity] || 'medium';
              const barColor = PRIORITY_BAR[prKey] || PRIORITY_BAR.medium;
              return (
                <li key={e.id} style={S.card}>
                  <span style={{ ...S.priorityBar, background: barColor }} aria-hidden="true" />
                  <Link href={`/bm/${e.id}`} style={S.cardLink}>
                    <div style={S.cardTop}>
                      <div style={S.pillRow}>
                        <span style={{
                          ...S.pill,
                          background: sev.bg, color: sev.fg, borderColor: sev.border,
                        }}>{sev.label}</span>
                        <span style={{
                          ...S.pill,
                          background: st.bg, color: st.fg, borderColor: st.border,
                        }}>{st.label}</span>
                      </div>
                      <span style={S.timeAgo}>{relativeTime(e.reported_at)}</span>
                    </div>

                    <div style={S.assetLine}>
                      <span style={S.assetTag}>{e.assets?.machine_asset_number || '—'}</span>
                      {e.assets?.name_en && <span style={S.assetName}> · {e.assets.name_en}</span>}
                    </div>

                    {e.symptom && (
                      <div style={S.symptom}>{e.symptom}</div>
                    )}

                    <div style={S.meta}>
                      {e.reporter_name && <span style={S.reporter}>{e.reporter_name}</span>}
                      {e.reporter_name && <span style={S.dot}>·</span>}
                      <span style={S.date}>{formatDate(e.reported_at)}</span>
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

// ── Empty state ──────────────────────────────────────────────────────
function EmptyState({ filter, isAuthed }) {
  const msg =
    filter === 'open'        ? '현재 접수된 고장이 없습니다' :
    filter === 'in_progress' ? '진행 중인 작업이 없습니다' :
    filter === 'resolved'    ? '완료된 BM 이력이 없습니다' :
                                'BM 이력이 없습니다';
  return (
    <div style={S.empty}>
      <div style={S.emptyIcon} aria-hidden="true">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.6 9.6a2.1 2.1 0 0 1-3-3z" />
          <path d="M16 4l4 4" />
        </svg>
      </div>
      <div style={S.emptyTitle}>{msg}</div>
      {isAuthed && (
        <Link href="/bm/new" style={S.emptyBtn}>
          + 고장 신고
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────
const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto',
  },

  // Header
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f172a',
    borderBottom: '1px solid #1f2937',
    padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  backLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 14,
    minHeight: 44, display: 'inline-flex', alignItems: 'center',
    padding: '0 4px',
  },
  title: {
    flex: 1, fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc',
    textAlign: 'center',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  userChip: {
    background: '#22c55e', color: '#fff', border: 'none', borderRadius: 999,
    padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    minHeight: 32,
  },
  loginLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 12,
    padding: '6px 10px', border: '1px solid #334155', borderRadius: 6,
  },
  fab: {
    width: 44, height: 44, borderRadius: '50%',
    background: '#dc2626', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none',
    boxShadow: '0 4px 12px rgba(220,38,38,0.5)',
  },
  fabPlus: { fontSize: 28, lineHeight: 1, fontWeight: 300, marginTop: -2 },
  menuBtn: {
    width: 44, height: 44,
    background: 'transparent', color: '#cbd5e1',
    border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6,
  },
  dropdown: {
    position: 'absolute', top: '100%', right: 0, marginTop: 4,
    background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
    minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    zIndex: 100, overflow: 'hidden',
  },
  dropdownItem: {
    display: 'block', padding: '12px 14px',
    color: '#e2e8f0', textDecoration: 'none',
    fontSize: 14, borderBottom: '1px solid #334155',
    transition: 'background 0.15s',
    '&:hover': { background: '#334155' },
  },

  // Tab bar
  tabBar: {
    position: 'sticky', top: 65, zIndex: 15,
    background: '#0f172a',
    display: 'flex', overflowX: 'auto',
    borderBottom: '1px solid #1f2937',
    WebkitOverflowScrolling: 'touch',
  },
  tab: {
    position: 'relative',
    flex: '1 0 auto', minWidth: 88,
    background: 'transparent', border: 'none',
    padding: '12px 12px 14px',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48,
  },
  tabActive: {},
  tabLabel: {
    fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
  },
  tabCount: {
    fontSize: 11, fontWeight: 700,
    padding: '2px 7px', borderRadius: 999,
    minWidth: 20, textAlign: 'center',
  },
  tabUnderline: {
    position: 'absolute', left: 12, right: 12, bottom: 0, height: 3,
    background: '#dc2626', borderRadius: '3px 3px 0 0',
  },

  // Search
  searchWrap: {
    position: 'relative', padding: '12px 14px',
  },
  searchIcon: {
    position: 'absolute', left: 26, top: '50%',
    transform: 'translateY(-50%)',
    color: '#64748b', pointerEvents: 'none',
    display: 'inline-flex',
  },
  search: {
    width: '100%', padding: '12px 38px 12px 40px',
    border: '1px solid #334155', borderRadius: 10, fontSize: 16,
    outline: 'none', boxSizing: 'border-box',
    background: '#1e293b', color: '#f1f5f9',
    minHeight: 44,
  },
  searchClear: {
    position: 'absolute', right: 22, top: '50%',
    transform: 'translateY(-50%)',
    width: 28, height: 28, borderRadius: '50%',
    background: '#334155', color: '#cbd5e1',
    border: 'none', cursor: 'pointer',
    fontSize: 18, lineHeight: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Status
  errorBox: {
    margin: 14, padding: 14,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 10, fontSize: 14,
  },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },

  // List & cards
  list: { listStyle: 'none', margin: 0, padding: '4px 14px 16px' },
  card: {
    position: 'relative',
    background: '#1e293b',
    borderRadius: 12, marginBottom: 10,
    overflow: 'hidden',
    border: '1px solid #1f2937',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  priorityBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
  },
  cardLink: {
    display: 'block', padding: '14px 14px 14px 18px',
    textDecoration: 'none', color: 'inherit',
    minHeight: 44,
  },
  cardTop: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 8, marginBottom: 8,
  },
  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pill: {
    padding: '3px 8px', borderRadius: 6,
    fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
    border: '1px solid',
    whiteSpace: 'nowrap',
  },
  timeAgo: {
    fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap',
    paddingTop: 3,
  },
  assetLine: {
    fontSize: 14, marginBottom: 6, lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  assetTag: {
    color: '#f8fafc', fontWeight: 700,
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  assetName: { color: '#cbd5e1' },
  symptom: {
    fontSize: 14, color: '#e2e8f0', lineHeight: 1.4,
    wordBreak: 'break-word', marginBottom: 8,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  meta: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, color: '#64748b',
  },
  reporter: { color: '#94a3b8' },
  dot: { color: '#475569' },
  date: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },

  // Empty state
  empty: {
    padding: '60px 24px',
    textAlign: 'center', color: '#64748b',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  emptyIcon: {
    color: '#334155',
    width: 80, height: 80, borderRadius: '50%',
    background: '#1e293b',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #334155',
  },
  emptyTitle: { fontSize: 15, color: '#94a3b8' },
  emptyBtn: {
    display: 'inline-block', marginTop: 8,
    background: '#dc2626', color: '#fff',
    padding: '12px 22px', borderRadius: 10,
    fontSize: 15, fontWeight: 700,
    textDecoration: 'none',
    boxShadow: '0 4px 12px rgba(220,38,38,0.4)',
    minHeight: 44,
  },
};
