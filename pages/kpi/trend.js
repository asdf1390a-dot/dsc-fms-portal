import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import BottomNav from '../../components/BottomNav';
import KpiTrendChart from '../../components/kpi/KpiTrendChart';
import { supabase } from '../../lib/supabase';

export default function KpiTrendPage() {
  const router = useRouter();
  const initialCat = (router.query.category || 'oee').toString();
  const [categoryId, setCategoryId] = useState(initialCat);
  const [categories, setCategories] = useState([]);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('kpi_categories')
        .select('id,name_ko,name_en,unit,group_name,sort_order')
        .eq('is_active', true)
        .order('sort_order');
      setCategories(data || []);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/kpi/trend?category=${categoryId}&months=6`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'fetch failed');
        if (cancelled) return;
        setTrend(json);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoryId]);

  const cat = trend?.category;
  const months = trend?.months || [];

  return (
    <>
      <Head>
        <title>KPI 추세 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/kpi" style={S.backLink}>← KPI</Link>
          <h1 style={S.title}>KPI 추세 (6개월)</h1>
          <div style={{ minWidth: 40 }} />
        </header>

        <div style={S.selectRow}>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={S.select}>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.group_name} · {c.name_ko} ({c.unit})</option>
            ))}
          </select>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : (
          <>
            <section style={S.chartCard}>
              <KpiTrendChart data={months} unit={cat?.unit || ''} />
            </section>

            <section style={S.tableCard}>
              <div style={S.sectionTitle}>월별 데이터</div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>월</th>
                    <th style={S.thR}>목표</th>
                    <th style={S.thR}>실적</th>
                    <th style={S.thR}>달성률</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => {
                    let rate = null;
                    if (m.target != null && m.actual != null && m.target !== 0) {
                      rate = cat?.direction === 'up'
                        ? Math.round((m.actual / m.target) * 1000) / 10
                        : Math.round((m.target / m.actual) * 1000) / 10;
                    }
                    return (
                      <tr key={m.month_iso}>
                        <td style={S.td}>{m.month_label}</td>
                        <td style={S.tdR}>{m.target ?? '—'}</td>
                        <td style={S.tdR}>{m.actual ?? '—'}</td>
                        <td style={S.tdR}>{rate != null ? `${rate}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 40 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, textAlign: 'center', color: '#f8fafc' },
  selectRow: { padding: 14 },
  select: { width: '100%', padding: '12px 14px', background: '#0b1220', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: 15, minHeight: 48 },
  chartCard: { background: '#1e293b', borderRadius: 12, padding: '12px 8px 8px', margin: '0 14px 12px', border: '1px solid #1f2937' },
  tableCard: { background: '#1e293b', borderRadius: 12, padding: 14, margin: '0 14px 14px', border: '1px solid #1f2937' },
  sectionTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 6px', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #1f2937', fontSize: 11 },
  thR: { textAlign: 'right', padding: '8px 6px', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #1f2937', fontSize: 11 },
  td: { padding: '8px 6px', color: '#cbd5e1', fontFamily: 'ui-monospace,Menlo,monospace', borderBottom: '1px solid #1f2937' },
  tdR: { padding: '8px 6px', color: '#e2e8f0', fontFamily: 'ui-monospace,Menlo,monospace', borderBottom: '1px solid #1f2937', textAlign: 'right' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
};
