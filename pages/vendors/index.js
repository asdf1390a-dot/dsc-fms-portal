import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';

export default function VendorsIndexPage() {
  const [vendors, setVendors] = useState([]);
  const [partCounts, setPartCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('active');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: vs, error: e1 } = await supabase.from('vendors').select('*').order('name');
      if (cancelled) return;
      if (e1) { setError(e1.message); setLoading(false); return; }
      setVendors(vs || []);

      // part counts per vendor
      const { data: parts } = await supabase.from('spare_parts').select('vendor_id').not('vendor_id', 'is', null);
      const counts = {};
      for (const p of parts || []) counts[p.vendor_id] = (counts[p.vendor_id] || 0) + 1;
      setPartCounts(counts);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors.filter(v => {
      if (tab === 'active' && !v.is_active) return false;
      if (tab === 'inactive' && v.is_active) return false;
      if (!q) return true;
      return (v.name || '').toLowerCase().includes(q) ||
             (v.name_short || '').toLowerCase().includes(q) ||
             (v.city || '').toLowerCase().includes(q);
    });
  }, [vendors, query, tab]);

  const counts = useMemo(() => ({
    active: vendors.filter(v => v.is_active).length,
    inactive: vendors.filter(v => !v.is_active).length,
  }), [vendors]);

  return (
    <>
      <Head>
        <title>공급업체 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/inventory" style={S.backLink}>← 재고</Link>
          <h1 style={S.title}>공급업체</h1>
          <Link href="/vendors/new" style={S.fab}>+</Link>
        </header>

        <div style={S.searchWrap}>
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} placeholder="업체명/도시 검색" style={S.searchInput} />
        </div>

        <div style={S.tabBar}>
          {[['active','활성'],['inactive','비활성']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={tab===k ? S.tabActive : S.tab}>
              {l} <span style={S.tabCount}>{counts[k]}</span>
            </button>
          ))}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}
        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>등록된 공급업체가 없습니다</div>
        ) : (
          <ul style={S.list}>
            {filtered.map(v => (
              <li key={v.id} style={S.card}>
                <Link href={`/vendors/${v.id}`} style={S.cardLink}>
                  <div style={S.cardName}>{v.name}</div>
                  <div style={S.cardMeta}>
                    {v.city ? `${v.city}, ${v.country}` : v.country}
                    {v.lead_time_days != null ? ` · 납기 ${v.lead_time_days}일` : ''}
                    {v.currency ? ` · ${v.currency}` : ''}
                  </div>
                  <div style={S.cardBottom}>
                    <span style={S.cardCount}>담당 부품 {partCounts[v.id] || 0}종</span>
                    <span style={S.viewLink}>보기 →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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
  title: { fontSize: 18, fontWeight: 700, flex: 1, margin: 0, textAlign: 'center', color: '#f8fafc' },
  fab: { width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 300 },
  searchWrap: { padding: '10px 14px 8px' },
  searchInput: { width: '100%', padding: '11px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 44 },
  tabBar: { display: 'flex', borderBottom: '1px solid #1f2937' },
  tab: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid transparent' },
  tabActive: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: 13, fontWeight: 800, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid #2563eb' },
  tabCount: { marginLeft: 6, fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  list: { listStyle: 'none', margin: 0, padding: '8px 14px 16px' },
  card: { background: '#1e293b', borderRadius: 12, marginBottom: 10, border: '1px solid #1f2937' },
  cardLink: { display: 'block', padding: 14, textDecoration: 'none', color: 'inherit' },
  cardName: { fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  cardBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardCount: { fontSize: 12, color: '#cbd5e1' },
  viewLink: { fontSize: 12, color: '#60a5fa', fontWeight: 700 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10 },
};
