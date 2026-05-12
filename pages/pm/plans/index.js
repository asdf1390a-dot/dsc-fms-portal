import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import BottomNav from '../../../components/BottomNav';

const FREQ_LABEL = {
  daily: '매일', weekly: '주간', biweekly: '격주', monthly: '월간',
  quarterly: '분기', biannual: '반기', annual: '연간',
};

export default function PMPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('active');
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Try pm_plan_summary view first (richer data), fall back to pm_plans.
      let { data, error: e1 } = await supabase.from('pm_plan_summary').select('*').order('asset_number');
      if (e1) {
        const fb = await supabase
          .from('pm_plans')
          .select('id, asset_id, title, frequency_days, frequency_label, category, is_active, assets(machine_asset_number, name_en)')
          .order('created_at', { ascending: false });
        if (fb.error) { setError(fb.error.message); setLoading(false); return; }
        data = (fb.data || []).map(p => ({
          plan_id: p.id,
          asset_id: p.asset_id,
          asset_number: p.assets?.machine_asset_number || null,
          asset_name: p.assets?.name_en || null,
          title: p.title,
          frequency_days: p.frequency_days,
          frequency_label: p.frequency_label,
          category: p.category,
          is_active: p.is_active,
        }));
      }
      setPlans(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter(p => {
      if (tab === 'active' && !p.is_active) return false;
      if (tab === 'inactive' && p.is_active) return false;
      if (!q) return true;
      return (p.title || '').toLowerCase().includes(q) ||
             (p.asset_number || '').toLowerCase().includes(q) ||
             (p.asset_name || '').toLowerCase().includes(q);
    });
  }, [plans, query, tab]);

  const counts = useMemo(() => ({
    active: plans.filter(p => p.is_active).length,
    inactive: plans.filter(p => !p.is_active).length,
    all: plans.length,
  }), [plans]);

  return (
    <>
      <Head>
        <title>PM 계획 마스터 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/pm" style={S.backLink}>← PM</Link>
          <h1 style={S.title}>PM 계획 마스터</h1>
          <Link href="/pm/new" style={S.fab}>+</Link>
        </header>

        <div style={S.searchWrap}>
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} placeholder="작업명/자산 검색" style={S.searchInput} />
        </div>

        <div style={S.tabBar}>
          {[['active','활성'],['inactive','비활성'],['all','전체']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={tab===k ? S.tabActive : S.tab}>
              {l} <span style={S.tabCount}>{counts[k]}</span>
            </button>
          ))}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>등록된 계획이 없습니다</div>
        ) : (
          <ul style={S.list}>
            {filtered.map(p => (
              <li key={p.plan_id} style={S.card}>
                <div style={S.cardHead}>
                  <span style={{ ...S.statusDot, background: p.is_active ? '#22c55e' : '#64748b' }} />
                  <span style={S.statusText}>{p.is_active ? '활성' : '비활성'}</span>
                </div>
                <div style={S.cardTitle}>{p.title}</div>
                <div style={S.cardAsset}>{p.asset_number || '—'}{p.asset_name ? ` · ${p.asset_name}` : ''}</div>
                <div style={S.cardMeta}>
                  🔄 {p.frequency_days}일 ({FREQ_LABEL[p.frequency_label] || p.frequency_label || ''})
                </div>
                {p.next_scheduled_date && (
                  <div style={S.cardNext}>
                    다음: {p.next_scheduled_date}
                    {p.this_month_total != null && (
                      <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                        이번 달 {p.this_month_done}/{p.this_month_total}
                        {p.overdue_count > 0 && <span style={{ color: '#fca5a5', marginLeft: 6 }}>· 지연 {p.overdue_count}</span>}
                      </span>
                    )}
                  </div>
                )}
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
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 50 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, textAlign: 'center', color: '#f8fafc' },
  fab: { width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 300 },
  searchWrap: { padding: '10px 14px 8px' },
  searchInput: { width: '100%', padding: '11px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 44 },
  tabBar: { display: 'flex', borderBottom: '1px solid #1f2937' },
  tab: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid transparent' },
  tabActive: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: 13, fontWeight: 800, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid #2563eb' },
  tabCount: { marginLeft: 6, fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  list: { listStyle: 'none', margin: 0, padding: '8px 14px 16px' },
  card: { background: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #1f2937' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  statusText: { fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 },
  cardAsset: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontFamily: 'ui-monospace,Menlo,monospace' },
  cardMeta: { fontSize: 12, color: '#cbd5e1', marginBottom: 4 },
  cardNext: { fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10 },
};
