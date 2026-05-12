import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import PMComplianceBar from '../../components/pm/PMComplianceBar';
import AssetPMGroup from '../../components/pm/AssetPMGroup';
import OverdueAlert from '../../components/pm/OverdueAlert';

function monthRange(month) {
  // month: 'YYYY-MM'
  const start = new Date(month + '-01');
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const p = n => String(n).padStart(2, '0');
  const f = d => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return { startStr: f(start), endStr: f(end) };
}

export default function PMReportPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();
  const [month, setMonth] = useState(() => {
    const d = new Date(); const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
  });
  const [schedules, setSchedules] = useState([]);
  const [plans, setPlans] = useState({});
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [authLoading, isAuthed, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { startStr, endStr } = monthRange(month);
        const { data: ss, error: se } = await supabase
          .from('pm_schedules')
          .select('id, plan_id, scheduled_date, status')
          .gte('scheduled_date', startStr)
          .lt('scheduled_date', endStr);
        if (se) throw se;
        if (cancelled) return;
        setSchedules(ss || []);

        const planIds = Array.from(new Set((ss || []).map(s => s.plan_id).filter(Boolean)));
        if (planIds.length > 0) {
          const { data: ps } = await supabase
            .from('pm_plans')
            .select('id, title, asset_id')
            .in('id', planIds);
          const pMap = {};
          (ps || []).forEach(p => { pMap[p.id] = p; });
          if (!cancelled) setPlans(pMap);

          const assetIds = Array.from(new Set((ps || []).map(p => p.asset_id).filter(Boolean)));
          if (assetIds.length > 0) {
            const { data: as_ } = await supabase
              .from('assets')
              .select('id, machine_asset_number, name_en, name_ko, location')
              .in('id', assetIds);
            const aMap = {};
            (as_ || []).forEach(a => { aMap[a.id] = a; });
            if (!cancelled) setAssets(aMap);
          }
        } else {
          if (!cancelled) { setPlans({}); setAssets({}); }
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [month]);

  const stats = useMemo(() => {
    const total = schedules.length;
    const done = schedules.filter(s => s.status === 'done' || s.status === 'completed').length;
    const overdue = schedules.filter(s => s.status === 'overdue').length;
    const skipped = schedules.filter(s => s.status === 'skipped').length;
    const pending = schedules.filter(s => s.status === 'pending').length;
    return { total, done, overdue, skipped, pending };
  }, [schedules]);

  // 설비별 그룹화
  const assetGroups = useMemo(() => {
    const groups = {};
    for (const s of schedules) {
      const plan = plans[s.plan_id];
      if (!plan) continue;
      const aid = plan.asset_id || 'none';
      if (!groups[aid]) {
        const a = assets[aid];
        groups[aid] = {
          asset_id: aid,
          asset_number: a?.machine_asset_number || '—',
          asset_name: a?.name_en || a?.name_ko || '미지정',
          location: a?.location || '',
          done: 0, total: 0, overdue: 0,
        };
      }
      groups[aid].total += 1;
      if (s.status === 'done' || s.status === 'completed') groups[aid].done += 1;
      if (s.status === 'overdue') groups[aid].overdue += 1;
    }
    return Object.values(groups).sort((a, b) => {
      // 연체 많은 순 → 이행률 낮은 순
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      const ra = a.total ? a.done / a.total : 1;
      const rb = b.total ? b.done / b.total : 1;
      return ra - rb;
    });
  }, [schedules, plans, assets]);

  function prevMonth() {
    const d = new Date(month + '-01'); d.setMonth(d.getMonth() - 1);
    const p = n => String(n).padStart(2, '0');
    setMonth(`${d.getFullYear()}-${p(d.getMonth() + 1)}`);
  }
  function nextMonth() {
    const d = new Date(month + '-01'); d.setMonth(d.getMonth() + 1);
    const p = n => String(n).padStart(2, '0');
    setMonth(`${d.getFullYear()}-${p(d.getMonth() + 1)}`);
  }

  return (
    <>
      <Head>
        <title>월간 PM 리포트 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/pm" style={S.back}>←</Link>
          <h1 style={S.title}>월간 PM 리포트</h1>
        </header>

        <div style={S.monthBar}>
          <button onClick={prevMonth} style={S.monthBtn}>‹</button>
          <span style={S.monthText}>{month}</span>
          <button onClick={nextMonth} style={S.monthBtn}>›</button>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}
        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : (
          <div style={S.section}>
            <OverdueAlert count={stats.overdue} href="/pm" />

            <div style={S.card}>
              <div style={S.cardTitle}>전체 이행률</div>
              <PMComplianceBar done={stats.done} total={stats.total} />
            </div>

            <div style={S.statsGrid}>
              <StatBox label="완료" value={stats.done} color="#22c55e" />
              <StatBox label="예정" value={stats.pending} color="#3b82f6" />
              <StatBox label="연체" value={stats.overdue} color="#ef4444" />
              <StatBox label="건너뜀" value={stats.skipped} color="#94a3b8" />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={S.sectionTitle}>설비별 이행률 ({assetGroups.length})</div>
              {assetGroups.length === 0 ? (
                <div style={S.muted}>해당 월에 PM 일정이 없습니다</div>
              ) : (
                assetGroups.map(a => <AssetPMGroup key={a.asset_id} asset={a} />)
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
      padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', maxWidth: 480, margin: '0 auto', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  back: { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textDecoration: 'none', fontSize: 22, borderRadius: 8 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, color: '#f1f5f9' },
  monthBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px 14px' },
  monthBtn: { width: 44, height: 44, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
  monthText: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', fontFamily: 'ui-monospace,Menlo,monospace' },
  section: { padding: '0 14px 16px' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: '14px 0 10px' },
  muted: { color: '#64748b', fontSize: 13, padding: 24, textAlign: 'center' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10 },
};
