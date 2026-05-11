import Head from 'next/head';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';

export default function KpiDashboard() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [kpi, setKpi] = useState(null);
  const [statusData, setStatusData] = useState([]);
  const [causeData, setCauseData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }
  const monthLabel = `${year}년 ${String(month).padStart(2, '0')}월`;
  const isCurrentMonth = (() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  })();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const targetMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const fromDate = new Date(year, month - 1, 1).toISOString();
      const toDate   = new Date(year, month, 1).toISOString();

      const [kpiRes, statusRes, causeRes] = await Promise.all([
        supabase.rpc('get_monthly_kpi', { target_month: targetMonth }),
        supabase.rpc('get_breakdown_by_status', { from_date: fromDate, to_date: toDate }),
        supabase.rpc('get_cause_distribution',  { from_date: fromDate, to_date: toDate }),
      ]);

      if (cancelled) return;

      if (kpiRes.error || statusRes.error || causeRes.error) {
        setError((kpiRes.error || statusRes.error || causeRes.error).message);
        setLoading(false);
        return;
      }

      setKpi(kpiRes.data?.[0] || null);
      setStatusData(statusRes.data || []);
      setCauseData(causeRes.data || []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [year, month]);

  const KPI_CARDS = [
    { label: 'MTTR', sub: '평균 수리 시간', value: kpi ? minsToHours(kpi.mttr_min) : '—', color: '#f97316' },
    { label: 'MTBF', sub: '평균 고장 간격', value: kpi ? minsToDays(kpi.mtbf_min) : '—', color: '#22c55e' },
    { label: '이달 BM', sub: '총 건수', value: kpi ? String(kpi.total_breakdowns ?? 0) : '—', color: '#ef4444' },
    { label: '평균 다운타임', sub: '분 단위', value: avgDowntime(kpi), color: '#8b5cf6' },
  ];

  return (
    <>
      <Head>
        <title>KPI 대시보드 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <h1 style={S.title}>KPI 대시보드</h1>
          <div style={S.monthPicker}>
            <button onClick={prevMonth} style={S.monthBtn}>‹</button>
            <span style={S.monthLabel}>{monthLabel}</span>
            <button onClick={nextMonth} style={{ ...S.monthBtn, opacity: isCurrentMonth ? 0.3 : 1 }} disabled={isCurrentMonth}>›</button>
          </div>
        </header>

        {error && <div style={S.errorBox}>{error}</div>}

        <section style={S.section}>
          <div style={S.sectionTitle}>월별 KPI 요약</div>
          <div style={S.cardGrid}>
            {KPI_CARDS.map(card => (
              <div key={card.label} style={{ ...S.kpiCard, borderTopColor: card.color }}>
                <div style={S.kpiLabel}>{card.label}</div>
                <div style={{ ...S.kpiValue, color: card.color }}>{loading ? '…' : card.value}</div>
                <div style={S.kpiSub}>{card.sub}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>BM 상태별 현황</div>
          <div style={S.pillWrap}>
            {STATUS_ORDER.map(key => {
              const meta = STATUS_META[key];
              const row = statusData.find(d => d.status === key);
              const cnt = row ? row.cnt : 0;
              return (
                <div key={key} style={{ ...S.statusPill, background: meta.bg, border: `1px solid ${meta.border}` }}>
                  <span style={{ ...S.statusPillLabel, color: meta.fg }}>{meta.label}</span>
                  <span style={{ ...S.statusPillCount, color: meta.fg }}>{loading ? '…' : cnt}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ ...S.section, paddingBottom: 24 }}>
          <div style={S.sectionTitle}>고장 원인 TOP 5</div>
          {!loading && causeData.length === 0 && <div style={S.emptyText}>이 기간 데이터가 없습니다</div>}
          {causeData.slice(0, 5).map((row, i) => {
            const barWidth = row.pct ? Math.max(4, row.pct) : 4;
            return (
              <div key={row.group_name || i} style={S.causeRow}>
                <div style={S.causeHeader}>
                  <span style={S.causeName}>{row.group_name || 'Unknown'}</span>
                  <span style={S.causeMeta}>{row.cnt}건 · {row.pct ?? 0}%</span>
                </div>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: `${barWidth}%`, background: ['#ef4444','#f97316','#eab308','#22c55e','#8b5cf6'][i] }} />
                </div>
              </div>
            );
          })}
        </section>
      </main>
      <BottomNav />
    </>
  );
}

function minsToHours(min) {
  if (min == null) return '—';
  return (min / 60).toFixed(1) + 'h';
}
function minsToDays(min) {
  if (min == null) return '—';
  return (min / 1440).toFixed(1) + 'd';
}
function avgDowntime(k) {
  if (!k || !k.total_breakdowns) return '—';
  return Math.round(k.total_downtime_min / k.total_breakdowns) + '분';
}

const STATUS_META = {
  open:          { label: 'OPEN',        fg: '#fca5a5', bg: 'rgba(220,38,38,0.18)',  border: 'rgba(220,38,38,0.6)' },
  in_progress:   { label: 'IN PROGRESS', fg: '#fdba74', bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.6)' },
  pending_parts: { label: 'WAIT PARTS',  fg: '#fde68a', bg: 'rgba(234,179,8,0.18)',  border: 'rgba(234,179,8,0.6)' },
  resolved:      { label: 'RESOLVED',    fg: '#86efac', bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.6)' },
  wontfix:       { label: "WON'T FIX",  fg: '#cbd5e1', bg: 'rgba(100,116,139,0.2)', border: 'rgba(100,116,139,0.6)' },
};
const STATUS_ORDER = ['open','in_progress','pending_parts','resolved','wontfix'];

const S = {
  page: { fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', background:'#0f172a', minHeight:'100vh', color:'#e2e8f0', paddingBottom:'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth:480, margin:'0 auto' },
  header: { position:'sticky', top:0, zIndex:20, background:'#0f172a', borderBottom:'1px solid #1f2937', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 2px 8px rgba(0,0,0,0.4)' },
  title: { fontSize:18, fontWeight:700, margin:0, color:'#f8fafc' },
  monthPicker: { display:'flex', alignItems:'center', gap:8 },
  monthBtn: { width:44, height:44, background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#e2e8f0', fontSize:22, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' },
  monthLabel: { fontSize:14, fontWeight:700, color:'#f1f5f9', minWidth:80, textAlign:'center', fontFamily:'ui-monospace,Menlo,Consolas,monospace' },
  section: { padding:'16px 14px 4px' },
  sectionTitle: { fontSize:11, fontWeight:800, letterSpacing:1, color:'#64748b', marginBottom:12, textTransform:'uppercase' },
  cardGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  kpiCard: { background:'#1e293b', borderRadius:12, padding:'14px 14px 16px', border:'1px solid #1f2937', borderTop:'3px solid transparent', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' },
  kpiLabel: { fontSize:10, fontWeight:800, letterSpacing:0.8, color:'#64748b', marginBottom:6, textTransform:'uppercase' },
  kpiValue: { fontSize:28, fontWeight:800, lineHeight:1, fontFamily:'ui-monospace,Menlo,Consolas,monospace', marginBottom:4 },
  kpiSub: { fontSize:11, color:'#475569' },
  pillWrap: { display:'flex', flexWrap:'wrap', gap:8 },
  statusPill: { display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:999 },
  statusPillLabel: { fontSize:11, fontWeight:800, letterSpacing:0.5 },
  statusPillCount: { fontSize:16, fontWeight:800, fontFamily:'ui-monospace,Menlo,Consolas,monospace' },
  causeRow: { marginBottom:14 },
  causeHeader: { display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 },
  causeName: { fontSize:13, fontWeight:600, color:'#e2e8f0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:8 },
  causeMeta: { fontSize:11, color:'#94a3b8', fontFamily:'ui-monospace,Menlo,Consolas,monospace', whiteSpace:'nowrap' },
  barTrack: { height:8, borderRadius:999, background:'#1e293b', overflow:'hidden' },
  barFill: { height:'100%', borderRadius:999, transition:'width 0.4s ease' },
  errorBox: { margin:'14px', padding:14, background:'rgba(220,38,38,0.15)', color:'#fca5a5', border:'1px solid rgba(220,38,38,0.4)', borderRadius:10, fontSize:14 },
  emptyText: { padding:'24px 0', textAlign:'center', color:'#475569', fontSize:14 },
};
