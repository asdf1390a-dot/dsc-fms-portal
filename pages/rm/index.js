import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';

const MONTH_KEYS = [
  'jan_amount','feb_amount','mar_amount','apr_amount',
  'may_amount','jun_amount','jul_amount','aug_amount',
  'sep_amount','oct_amount','nov_amount','dec_amount',
];
const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

// 0 = all (Jan~Apr cumulative), 1..12 = single month
const MONTH_FILTER_OPTIONS = [
  { value: 0, label: '누계 (1~4월)' },
  { value: 1, label: '1월' },
  { value: 2, label: '2월' },
  { value: 3, label: '3월' },
  { value: 4, label: '4월' },
];

function fmtRs(n) {
  if (n == null || isNaN(n)) return '–';
  return 'Rs ' + Number(n).toLocaleString();
}

function groupLabel(g) {
  if (g === 'R&M') return 'R&M (1.x)';
  if (g === '부자재') return '부자재 (2.x · 3.x)';
  return g;
}

function groupColor(g) {
  if (g === 'R&M') return { bg: 'rgba(56,189,248,.12)', bd: 'rgba(56,189,248,.35)', tx: '#7dd3fc' };
  if (g === '부자재') return { bg: 'rgba(34,197,94,.12)', bd: 'rgba(34,197,94,.35)', tx: '#86efac' };
  return { bg: 'rgba(148,163,184,.12)', bd: 'rgba(148,163,184,.35)', tx: '#cbd5e1' };
}

export default function RmIndexPage() {
  const [expenses, setExpenses] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [wbs, setWbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthFilter, setMonthFilter] = useState(0); // 0=cumulative Jan-Apr
  const [year] = useState(2026);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [exp, exc, wb] = await Promise.all([
        supabase.from('rm_expenses')
          .select('*')
          .eq('year', year)
          .order('sort_order', { ascending: true }),
        supabase.from('rm_excluded_items')
          .select('*')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        supabase.from('rm_workbooks')
          .select('key, title_en, title_ko, sort_order')
          .order('sort_order', { ascending: true }),
      ]);
      if (cancelled) return;

      if (exp.error) {
        setError(exp.error.message);
      } else {
        setExpenses(exp.data || []);
      }
      if (!exc.error) setExcluded(exc.data || []);
      if (!wb.error)  setWbs(wb.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [year]);

  // active rows only (exclude is_read_only — 4.1/4.2/4.3 are shown in 제외 섹션)
  const activeRows = useMemo(
    () => expenses.filter(r => !r.is_read_only),
    [expenses]
  );

  function amountFor(row) {
    if (monthFilter === 0) {
      // Cumulative Jan..Apr
      return ['jan_amount','feb_amount','mar_amount','apr_amount']
        .reduce((s, k) => s + Number(row[k] || 0), 0);
    }
    return Number(row[MONTH_KEYS[monthFilter - 1]] || 0);
  }

  const grandTotal = useMemo(
    () => activeRows.reduce((s, r) => s + amountFor(r), 0),
    [activeRows, monthFilter]
  );

  const byGroup = useMemo(() => {
    const m = new Map();
    for (const r of activeRows) {
      if (!m.has(r.category_group)) m.set(r.category_group, []);
      m.get(r.category_group).push(r);
    }
    // stable group order: R&M → 부자재 → others
    const order = ['R&M', '부자재'];
    return [...m.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [activeRows]);

  return (
    <>
      <Head><title>R&M 비용 관리 | DSC FMS</title></Head>
      <main style={S.page}>
        <header style={S.header}>
          <h1 style={S.h1}>R&M 비용 관리</h1>
          <p style={S.sub}>13개 카테고리 · {year}년 · 단위 Rs</p>
        </header>

        {error && <div style={S.err}>오류: {error}</div>}
        {loading && <div style={S.muted}>불러오는 중…</div>}

        {/* Month filter */}
        <div style={S.filterRow}>
          {MONTH_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMonthFilter(opt.value)}
              style={{
                ...S.chip,
                ...(monthFilter === opt.value ? S.chipActive : {}),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Grand total */}
        <div style={S.totalBox}>
          <div style={S.totalLabel}>합계</div>
          <div style={S.totalValue}>{fmtRs(grandTotal)}</div>
        </div>

        {/* Category cards grouped */}
        {byGroup.map(([grp, rows]) => {
          const c = groupColor(grp);
          const subTotal = rows.reduce((s, r) => s + amountFor(r), 0);
          return (
            <section key={grp} style={S.section}>
              <div style={S.sectionHead}>
                <span style={{ ...S.groupPill, background: c.bg, borderColor: c.bd, color: c.tx }}>
                  {groupLabel(grp)}
                </span>
                <span style={S.sectionTotal}>{fmtRs(subTotal)}</span>
              </div>
              <div style={S.grid}>
                {rows.map(r => {
                  const amt = amountFor(r);
                  const pct = grandTotal > 0 ? (amt * 100 / grandTotal) : 0;
                  return (
                    <div key={r.id} style={S.card}>
                      <div style={S.cardKey}>{r.category_code}</div>
                      <div style={S.cardTitle}>{r.category_name_ko || r.category_name}</div>
                      <div style={S.cardSub}>{r.category_name}</div>
                      <div style={S.cardAmt}>{fmtRs(amt)}</div>
                      <div style={S.cardPct}>{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Excluded items section */}
        {excluded.length > 0 && (
          <section style={S.section}>
            <div style={S.sectionHead}>
              <span style={{ ...S.groupPill, background: 'rgba(234,179,8,.10)', borderColor: 'rgba(234,179,8,.35)', color: '#fde68a' }}>
                제외 항목 (참고용)
              </span>
              <span style={S.sectionTotalMuted}>기술팀 관제 외</span>
            </div>
            <div style={S.excludedGrid}>
              {excluded.map(it => (
                <div key={it.id} style={S.excludedCard}>
                  <div style={S.exHead}>
                    <span style={S.exName}>{it.item_name}</span>
                    <span style={S.exGroup}>{it.category_group}</span>
                  </div>
                  {it.item_name_en && <div style={S.exEn}>{it.item_name_en}</div>}
                  <div style={S.exReason}>{it.reason}</div>
                  {it.linked_code && <div style={S.exLink}>연결 코드: {it.linked_code}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legacy workbook ledgers — keep entry point */}
        {wbs.length > 0 && (
          <section style={S.section}>
            <div style={S.sectionHead}>
              <span style={{ ...S.groupPill, background:'rgba(148,163,184,.12)', borderColor:'rgba(148,163,184,.35)', color:'#cbd5e1' }}>
                Excel 원장 (월별 상세)
              </span>
            </div>
            <div style={S.grid}>
              {wbs.map(wb => (
                <Link key={wb.key} href={`/rm/${encodeURIComponent(wb.key)}`} style={S.cardLink}>
                  <div style={S.cardKey}>{wb.key}</div>
                  <div style={S.cardTitle}>{wb.title_ko}</div>
                  <div style={S.cardSub}>{wb.title_en}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: { background:'#0b1220', minHeight:'100vh', color:'#e2e8f0', padding:'16px 12px 96px', fontFamily:'Inter, "Noto Sans KR", sans-serif' },
  header: { marginBottom:12 },
  h1: { fontSize:22, fontWeight:700, margin:0, color:'#f1f5f9' },
  sub: { fontSize:13, color:'#94a3b8', margin:'4px 0 0' },
  err: { background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.4)', color:'#fca5a5', padding:'10px 12px', borderRadius:8, marginBottom:12, fontSize:14 },
  muted: { color:'#64748b', fontSize:14, marginBottom:12 },

  filterRow: { display:'flex', gap:6, overflowX:'auto', paddingBottom:6, marginBottom:10 },
  chip: { flex:'0 0 auto', minHeight:44, padding:'8px 14px', borderRadius:999, border:'1px solid #1f2a3d', background:'#111c2e', color:'#cbd5e1', fontSize:14, cursor:'pointer' },
  chipActive: { background:'#1d4ed8', borderColor:'#3b82f6', color:'#fff' },

  totalBox: { background:'#0f1a2c', border:'1px solid #1f2a3d', borderRadius:12, padding:'12px 14px', marginBottom:14, display:'flex', alignItems:'baseline', justifyContent:'space-between' },
  totalLabel: { fontSize:13, color:'#94a3b8' },
  totalValue: { fontSize:20, fontWeight:700, color:'#f1f5f9' },

  section: { marginBottom:18 },
  sectionHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  groupPill: { display:'inline-block', padding:'4px 10px', borderRadius:999, border:'1px solid', fontSize:12, fontWeight:600 },
  sectionTotal: { fontSize:13, color:'#e2e8f0', fontWeight:600 },
  sectionTotalMuted: { fontSize:12, color:'#94a3b8' },

  grid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  card: { background:'#111c2e', border:'1px solid #1f2a3d', borderRadius:12, padding:12, minHeight:110 },
  cardLink: { display:'block', background:'#111c2e', border:'1px solid #1f2a3d', borderRadius:12, padding:12, textDecoration:'none', color:'inherit' },
  cardKey: { fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:0.4 },
  cardTitle: { fontSize:15, fontWeight:700, color:'#f1f5f9', margin:'2px 0 1px' },
  cardSub: { fontSize:11, color:'#94a3b8' },
  cardAmt: { fontSize:15, fontWeight:700, color:'#7dd3fc', marginTop:8 },
  cardPct: { fontSize:11, color:'#94a3b8', marginTop:2 },

  excludedGrid: { display:'grid', gridTemplateColumns:'1fr', gap:8 },
  excludedCard: { background:'#1a1608', border:'1px solid rgba(234,179,8,.25)', borderRadius:12, padding:12 },
  exHead: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  exName: { fontSize:15, fontWeight:700, color:'#fde68a' },
  exGroup: { fontSize:11, color:'#fbbf24' },
  exEn: { fontSize:12, color:'#fcd34d', marginTop:2 },
  exReason: { fontSize:13, color:'#fef3c7', marginTop:6, lineHeight:1.5 },
  exLink: { fontSize:11, color:'#fbbf24', marginTop:6 },
};
