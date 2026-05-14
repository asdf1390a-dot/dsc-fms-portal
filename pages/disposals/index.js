import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── 처분코드 → 색상/라벨 ──────────────────────────────────────────────
const CODE_PILL = {
  '폐기': { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)' },
  '매각': { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)' },
  '등록': { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)' },
};

const STATUS_PILL = {
  draft:    { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)', label: 'DRAFT' },
  pending:  { bg: 'rgba(234,179,8,0.18)',  fg: '#fde68a', border: 'rgba(234,179,8,0.6)',  label: 'PENDING' },
  approved: { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)',  label: 'APPROVED' },
  rejected: { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)',  label: 'REJECTED' },
};

const FILTERS = [
  { key: 'all',  label: '전체' },
  { key: '폐기', label: '폐기' },
  { key: '매각', label: '매각' },
  { key: '등록', label: '등록' },
];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtINR(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

export default function DisposalsListPage() {
  const { isAuthed, employeeId, fullName, signOut } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('fixed_asset_disposals')
        .select('id, asset_no, account_type, asset_name, spec, disposal_code, disposal_amount, disposal_qty, disposal_date, acquisition_cost, accumulated_depreciation, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      setRows(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => ({
    all:  rows.length,
    '폐기': rows.filter(r => r.disposal_code === '폐기').length,
    '매각': rows.filter(r => r.disposal_code === '매각').length,
    '등록': rows.filter(r => r.disposal_code === '등록').length,
  }), [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter !== 'all' && r.disposal_code !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.asset_no, r.asset_name, r.spec, r.account_type]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  return (
    <>
      <Head>
        <title>고정자산 처분 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backLink} aria-label="홈">← 홈</Link>
          <h1 style={S.title}>고정자산 처분</h1>
          <div style={S.headerRight}>
            {isAuthed ? (
              <button onClick={signOut} style={S.userChip} title={fullName || '로그인됨'}>
                {employeeId || '✓'}
              </button>
            ) : (
              <Link href="/login" style={S.loginLink}>로그인</Link>
            )}
          </div>
        </header>

        <div style={S.tabBar}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={S.tab}
              >
                <span style={{ ...S.tabLabel, color: active ? '#fff' : '#94a3b8' }}>{f.label}</span>
                <span style={{
                  ...S.tabCount,
                  background: active ? '#dc2626' : '#1f2937',
                  color: active ? '#fff' : '#94a3b8',
                }}>{counts[f.key]}</span>
                {active && <span style={S.tabUnderline} />}
              </button>
            );
          })}
        </div>

        <div style={S.searchWrap}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="자산명 / 자산NO / 규격 검색…"
            style={S.search}
            inputMode="search"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} style={S.searchClear} aria-label="초기화">×</button>
          )}
        </div>

        {error && (
          <div style={S.errorBox}>
            {error}
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
              Has `10_asset_disposal.sql` been run in Supabase?
            </div>
          </div>
        )}

        {loading && <div style={S.loading}>불러오는 중…</div>}

        {!loading && !error && filtered.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyTitle}>처분 신청 내역이 없습니다</div>
            {isAuthed && (
              <Link href="/disposals/new" style={S.emptyBtn}>+ 신규 신청</Link>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <ul style={S.list}>
            {filtered.map(r => {
              const code = CODE_PILL[r.disposal_code] || CODE_PILL['폐기'];
              const st = STATUS_PILL[r.status] || STATUS_PILL.draft;
              const bookValue = (Number(r.acquisition_cost) || 0) - (Number(r.accumulated_depreciation) || 0);
              return (
                <li key={r.id} style={S.card}>
                  <Link href={`/disposals/${r.id}`} style={S.cardLink}>
                    <div style={S.cardTop}>
                      <div style={S.pillRow}>
                        <span style={{ ...S.pill, background: code.bg, color: code.fg, borderColor: code.border }}>
                          {r.disposal_code}
                        </span>
                        <span style={{ ...S.pill, background: st.bg, color: st.fg, borderColor: st.border }}>
                          {st.label}
                        </span>
                      </div>
                      <span style={S.timeAgo}>{formatDate(r.disposal_date) || formatDate(r.created_at)}</span>
                    </div>

                    <div style={S.assetLine}>
                      {r.asset_no && <span style={S.assetTag}>{r.asset_no}</span>}
                      {r.asset_no && r.asset_name && <span style={S.assetName}> · </span>}
                      <span style={S.assetName}>{r.asset_name}</span>
                    </div>

                    {r.spec && <div style={S.spec}>{r.spec}</div>}

                    <div style={S.meta}>
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>처분가</span>
                        <span style={S.metaValueAmount}>{fmtINR(r.disposal_amount)}</span>
                      </div>
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>장부가</span>
                        <span style={S.metaValue}>{fmtINR(bookValue)}</span>
                      </div>
                      {r.disposal_qty != null && (
                        <div style={S.metaItem}>
                          <span style={S.metaLabel}>수량</span>
                          <span style={S.metaValue}>{r.disposal_qty}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* 우하단 FAB */}
        {isAuthed && (
          <Link href="/disposals/new" style={S.fab} aria-label="신규 신청">
            <span style={S.fabPlus}>+</span>
          </Link>
        )}
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto', position: 'relative',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  backLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 14,
    minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 4px',
  },
  title: { flex: 1, fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc', textAlign: 'center' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  userChip: {
    background: '#22c55e', color: '#fff', border: 'none', borderRadius: 999,
    padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 32,
  },
  loginLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 12,
    padding: '6px 10px', border: '1px solid #334155', borderRadius: 6,
  },

  tabBar: {
    position: 'sticky', top: 65, zIndex: 15,
    background: '#0f172a',
    display: 'flex', overflowX: 'auto',
    borderBottom: '1px solid #1f2937',
    WebkitOverflowScrolling: 'touch',
  },
  tab: {
    position: 'relative', flex: '1 0 auto', minWidth: 80,
    background: 'transparent', border: 'none',
    padding: '12px 12px 14px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48,
  },
  tabLabel: { fontSize: 13, fontWeight: 700, letterSpacing: 0.4 },
  tabCount: {
    fontSize: 11, fontWeight: 700, padding: '2px 7px',
    borderRadius: 999, minWidth: 20, textAlign: 'center',
  },
  tabUnderline: {
    position: 'absolute', left: 12, right: 12, bottom: 0, height: 3,
    background: '#dc2626', borderRadius: '3px 3px 0 0',
  },

  searchWrap: { position: 'relative', padding: '12px 14px' },
  search: {
    width: '100%', padding: '12px 38px 12px 14px',
    border: '1px solid #334155', borderRadius: 10, fontSize: 16,
    outline: 'none', boxSizing: 'border-box',
    background: '#1e293b', color: '#f1f5f9', minHeight: 44,
  },
  searchClear: {
    position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)',
    width: 28, height: 28, borderRadius: '50%',
    background: '#334155', color: '#cbd5e1', border: 'none', cursor: 'pointer',
    fontSize: 18, lineHeight: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  errorBox: {
    margin: 14, padding: 14,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14,
  },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },

  list: { listStyle: 'none', margin: 0, padding: '4px 14px 16px' },
  card: {
    background: '#1e293b', borderRadius: 12, marginBottom: 10,
    overflow: 'hidden', border: '1px solid #1f2937',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  cardLink: {
    display: 'block', padding: '14px', textDecoration: 'none', color: 'inherit', minHeight: 44,
  },
  cardTop: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 8, marginBottom: 8,
  },
  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pill: {
    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
    letterSpacing: 0.5, border: '1px solid', whiteSpace: 'nowrap',
  },
  timeAgo: {
    fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap',
    paddingTop: 3, fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  assetLine: { fontSize: 14, marginBottom: 4, lineHeight: 1.3, wordBreak: 'break-word' },
  assetTag: { color: '#f8fafc', fontWeight: 700, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  assetName: { color: '#cbd5e1' },
  spec: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },

  meta: {
    display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8,
    paddingTop: 8, borderTop: '1px solid #334155',
  },
  metaItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  metaLabel: { fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: 0.4 },
  metaValue: { fontSize: 12, color: '#e2e8f0', fontWeight: 600 },
  metaValueAmount: { fontSize: 13, color: '#fbbf24', fontWeight: 700 },

  empty: {
    padding: '60px 24px', textAlign: 'center', color: '#64748b',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  emptyTitle: { fontSize: 15, color: '#94a3b8' },
  emptyBtn: {
    display: 'inline-block', marginTop: 8,
    background: '#dc2626', color: '#fff',
    padding: '12px 22px', borderRadius: 10,
    fontSize: 15, fontWeight: 700, textDecoration: 'none',
    boxShadow: '0 4px 12px rgba(220,38,38,0.4)', minHeight: 44,
  },

  fab: {
    position: 'fixed', right: 16, bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
    width: 56, height: 56, borderRadius: '50%',
    background: '#dc2626', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', zIndex: 30,
    boxShadow: '0 6px 16px rgba(220,38,38,0.5)',
  },
  fabPlus: { fontSize: 32, lineHeight: 1, fontWeight: 300, marginTop: -2 },
};
