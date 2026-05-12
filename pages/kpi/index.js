import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import KpiCardGroup from '../../components/kpi/KpiCardGroup';
import KpiSyncButton from '../../components/kpi/KpiSyncButton';

const GROUP_ORDER = ['생산', '품질', '보전', '안전'];

export default function KpiDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [year, setYear]   = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const monthLabel = `${year}년 ${String(month).padStart(2, '0')}월`;
  const targetMonth = `${year}-${String(month).padStart(2, '0')}-01`;

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // admin check
  useEffect(() => {
    let cancelled = false;
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles').select('role').eq('user_id', user.id).maybeSingle();
      if (!cancelled) setIsAdmin(data?.role === 'admin');
    })();
    return () => { cancelled = true; };
  }, [user]);

  // dashboard fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        if (!cancelled) { setError('로그인이 필요합니다'); setLoading(false); }
        return;
      }
      const r = await fetch(`/api/kpi/dashboard?month=${targetMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (cancelled) return;
      if (!r.ok) { setError(j.error || `HTTP ${r.status}`); setLoading(false); return; }
      setItems(j.items || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [targetMonth, reloadKey]);

  const grouped = GROUP_ORDER.map(g => ({
    name: g,
    list: items.filter(it => it.group_name === g),
  })).filter(g => g.list.length > 0);

  return (
    <>
      <Head>
        <title>KPI 리포트 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <h1 style={S.title}>KPI 리포트</h1>
          <div style={S.monthPicker}>
            <button onClick={prevMonth} style={S.monthBtn}>‹</button>
            <span style={S.monthLabel}>{monthLabel}</span>
            <button onClick={nextMonth} style={S.monthBtn}>›</button>
          </div>
        </header>

        {isAdmin && (
          <div style={S.adminBar}>
            <Link href={`/kpi/input?month=${targetMonth}`} style={S.inputLink}>입력 →</Link>
            <KpiSyncButton month={targetMonth} onSynced={() => setReloadKey(k => k + 1)} />
          </div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}

        {loading && <div style={S.emptyText}>불러오는 중…</div>}

        {!loading && grouped.length === 0 && (
          <div style={S.emptyText}>KPI 데이터가 없습니다</div>
        )}

        {!loading && grouped.map(g => (
          <KpiCardGroup key={g.name} groupName={g.name} items={g.list} />
        ))}

        <div style={S.trendLinkWrap}>
          <span style={S.trendLink}>추세 차트 보기 → (Phase 2)</span>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page:   { fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  title:  { fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' },
  monthPicker: { display: 'flex', alignItems: 'center', gap: 8 },
  monthBtn:    { width: 44, height: 44, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 22, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  monthLabel:  { fontSize: 14, fontWeight: 700, color: '#f1f5f9', minWidth: 100, textAlign: 'center', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  adminBar:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', gap: 8 },
  inputLink:   { height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #ef4444', color: '#ef4444', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' },
  errorBox:    { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  emptyText:   { padding: '24px 0', textAlign: 'center', color: '#475569', fontSize: 14 },
  trendLinkWrap: { padding: '20px 14px', textAlign: 'center' },
  trendLink:   { fontSize: 12, color: '#475569' },
};
