import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';

export default function ProductivityIndexPage() {
  const [wbs, setWbs] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: list, error: e1 } = await supabase
        .from('productivity_workbooks')
        .select('key, title_en, title_ko, year, sort_order, columns')
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (e1) { setError(e1.message); setLoading(false); return; }
      setWbs(list || []);

      const { data: rows, error: e2 } = await supabase
        .from('productivity_monthly_rows')
        .select('workbook_key');
      if (cancelled) return;
      if (!e2 && rows) {
        const tally = {};
        for (const r of rows) tally[r.workbook_key] = (tally[r.workbook_key] || 0) + 1;
        setCounts(tally);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Head><title>생산성 관리 | DSC FMS</title></Head>
      <main style={S.page}>
        <header style={S.header}>
          <h1 style={S.h1}>생산성 관리</h1>
          <p style={S.sub}>Productivity · Excel-mirrored monthly performance matrix</p>
        </header>

        {error && <div style={S.err}>오류: {error}</div>}
        {loading && <div style={S.muted}>불러오는 중…</div>}

        <div style={S.grid}>
          {wbs.map(wb => {
            const cnt = counts[wb.key] || 0;
            const nCols = Array.isArray(wb.columns) ? wb.columns.length : 0;
            return (
              <Link key={wb.key} href={`/productivity/${encodeURIComponent(wb.key)}`} style={S.card}>
                <div style={S.cardKey}>{wb.key}</div>
                <div style={S.cardTitle}>{wb.title_ko}</div>
                <div style={S.cardSub}>{wb.title_en}</div>
                <div style={S.cardStats}>
                  <span style={S.stat}>{cnt.toLocaleString()} 행</span>
                  <span style={S.dot}>·</span>
                  <span style={S.stat}>{nCols} 컬럼</span>
                  <span style={S.dot}>·</span>
                  <span style={S.stat}>2025-11 ~ 2026-12</span>
                </div>
              </Link>
            );
          })}
          {!loading && !wbs.length && (
            <div style={S.muted}>워크북이 없습니다. db/49_productivity_schema.sql 실행 후 import-productivity.mjs 를 돌려 주세요.</div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: { background:'#0b1220', minHeight:'100vh', color:'#e2e8f0', padding:'16px 12px 96px', fontFamily:'Inter, "Noto Sans KR", sans-serif' },
  header: { marginBottom:16 },
  h1: { fontSize:22, fontWeight:700, margin:0, color:'#f1f5f9' },
  sub: { fontSize:13, color:'#94a3b8', margin:'4px 0 0' },
  err: { background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.4)', color:'#fca5a5', padding:'10px 12px', borderRadius:8, marginBottom:12, fontSize:14 },
  muted: { color:'#64748b', fontSize:14 },
  grid: { display:'grid', gridTemplateColumns:'1fr', gap:10 },
  card: { display:'block', background:'#111c2e', border:'1px solid #1f2a3d', borderRadius:12, padding:14, textDecoration:'none', color:'inherit' },
  cardKey: { fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing:0.4 },
  cardTitle: { fontSize:17, fontWeight:700, color:'#f1f5f9', margin:'2px 0 1px' },
  cardSub: { fontSize:12, color:'#94a3b8' },
  cardStats: { marginTop:10, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' },
  stat: { fontSize:12, color:'#cbd5e1' },
  dot: { color:'#475569' },
};
