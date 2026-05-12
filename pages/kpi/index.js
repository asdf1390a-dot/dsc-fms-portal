import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import KpiCard from '../../components/kpi/KpiCard';

const GROUP_ORDER = ['생산', '품질', '보전', '안전'];

export default function KpiDashboard() {
  const { isAuthed, role } = useAuth();
  const isAdmin = role === 'admin' || isAuthed; // 임시: 로그인 사용자=관리자
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const monthIso = `${year}-${String(month).padStart(2, '0')}`;
  const monthLabel = `${year}년 ${String(month).padStart(2, '0')}월`;
  const isCurrentMonth = (() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  })();

  function prevMonth() { if (month === 1) { setYear(y=>y-1); setMonth(12); } else setMonth(m=>m-1); }
  function nextMonth() { if (isCurrentMonth) return; if (month === 12) { setYear(y=>y+1); setMonth(1); } else setMonth(m=>m+1); }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kpi/dashboard?month=${monthIso}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'fetch failed');
      setItems(json.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [monthIso]);

  async function syncAuto() {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setSyncMsg('로그인이 필요합니다'); return; }
      const res = await fetch('/api/kpi/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: monthIso }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'sync failed');
      setSyncMsg('✓ BM 이력 동기화 완료');
      await load();
      setTimeout(() => setSyncMsg(null), 2500);
    } catch (e) {
      setSyncMsg('에러: ' + e.message);
    } finally {
      setSyncBusy(false);
    }
  }

  // Group by group_name
  const groups = {};
  for (const it of items) {
    if (!groups[it.group_name]) groups[it.group_name] = [];
    groups[it.group_name].push(it);
  }

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
          {isAdmin && <Link href="/kpi/input" style={S.adminLink}>입력 →</Link>}
        </header>

        <div style={S.monthBar}>
          <button onClick={prevMonth} style={S.monthBtn}>‹</button>
          <span style={S.monthLabel}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ ...S.monthBtn, opacity: isCurrentMonth ? 0.3 : 1 }} disabled={isCurrentMonth}>›</button>
        </div>

        {isAdmin && (
          <div style={S.syncRow}>
            <button onClick={syncAuto} disabled={syncBusy} style={syncBusy ? S.syncBtnBusy : S.syncBtn}>
              {syncBusy ? '동기화 중…' : '🔄 BM 자동 동기화 (MTTR/MTBF)'}
            </button>
            {syncMsg && <div style={S.syncMsg}>{syncMsg}</div>}
          </div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}
        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : items.length === 0 ? (
          <div style={S.empty}>
            등록된 KPI 실적이 없습니다.
            {isAdmin && <div style={{ marginTop: 12 }}><Link href="/kpi/input" style={S.emptyLink}>입력 페이지로 이동 →</Link></div>}
          </div>
        ) : (
          GROUP_ORDER.map(g => groups[g] && groups[g].length > 0 ? (
            <section key={g} style={S.section}>
              <div style={S.sectionTitle}>{g}</div>
              {groups[g].map(item => <KpiCard key={item.category_id} item={item} />)}
            </section>
          ) : null)
        )}

        <div style={S.footerLinks}>
          <Link href="/bm/stats" style={S.footerLink}>BM 통계 →</Link>
          <Link href="/kpi/trend" style={S.footerLink}>추세 차트 →</Link>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' },
  adminLink: { color: '#60a5fa', textDecoration: 'none', fontSize: 14, fontWeight: 700 },
  monthBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '12px 16px', background: '#0b1220', borderBottom: '1px solid #1f2937' },
  monthBtn: { width: 44, height: 44, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 22, cursor: 'pointer' },
  monthLabel: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', minWidth: 120, textAlign: 'center', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  syncRow: { padding: '12px 16px 4px' },
  syncBtn: { width: '100%', padding: '12px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#fdba74', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  syncBtnBusy: { width: '100%', padding: '12px 14px', background: '#1f2937', border: '1px solid #334155', borderRadius: 10, color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', minHeight: 44 },
  syncMsg: { marginTop: 8, fontSize: 12, color: '#86efac', textAlign: 'center' },
  section: { padding: '14px 14px 4px' },
  sectionTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 },
  emptyLink: { color: '#60a5fa', textDecoration: 'none', fontWeight: 700 },
  footerLinks: { display: 'flex', gap: 10, padding: '16px 14px 4px' },
  footerLink: { flex: 1, padding: '12px 14px', background: '#1e293b', border: '1px solid #1f2937', borderRadius: 10, color: '#60a5fa', textDecoration: 'none', fontSize: 13, fontWeight: 700, textAlign: 'center' },
};
