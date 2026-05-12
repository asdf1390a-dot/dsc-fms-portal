import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';
import BottomNav from '../../../components/BottomNav';
import ScheduleTimeline from '../../../components/pm/ScheduleTimeline';
import WorkLogList from '../../../components/pm/WorkLogList';
import PMComplianceBar from '../../../components/pm/PMComplianceBar';

const FREQ_LABEL = {
  daily: '매일', weekly: '주간', biweekly: '격주', monthly: '월간',
  quarterly: '분기', biannual: '반기', annual: '연간',
};

export default function PlanDetailPage() {
  const router = useRouter();
  const { planId } = router.query;
  const { isAuthed, loading: authLoading } = useAuth();

  const [tab, setTab] = useState('overview'); // overview | schedule | logs
  const [plan, setPlan] = useState(null);
  const [asset, setAsset] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(() => {
    const d = new Date(); const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
  });

  // auth gate (redirect when not signed in)
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [authLoading, isAuthed, router]);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        // 1) plan
        const { data: p, error: pe } = await supabase
          .from('pm_plans')
          .select('id, title, asset_id, frequency_days, frequency_label, category, is_active, checklist, description')
          .eq('id', planId).maybeSingle();
        if (pe) throw pe;
        if (cancelled) return;
        setPlan(p);

        // 2) asset
        if (p?.asset_id) {
          const { data: a } = await supabase
            .from('assets')
            .select('id, machine_asset_number, name_en, name_ko, location')
            .eq('id', p.asset_id).maybeSingle();
          if (!cancelled) setAsset(a);
        }

        // 3) schedules
        const { data: ss } = await supabase
          .from('pm_schedules')
          .select('id, plan_id, scheduled_date, status')
          .eq('plan_id', planId)
          .order('scheduled_date', { ascending: false });
        if (!cancelled) setSchedules(ss || []);

        // 4) logs — via schedule_id IN (...)
        const schedIds = (ss || []).map(s => s.id);
        if (schedIds.length > 0) {
          const { data: ls } = await supabase
            .from('pm_work_logs')
            .select('id, schedule_id, worker_name, completed_by_name, completed_at, created_at, result, notes')
            .in('schedule_id', schedIds)
            .order('completed_at', { ascending: false });
          if (!cancelled) setLogs(ls || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planId]);

  const monthDate = useMemo(() => new Date(month + '-01'), [month]);
  const monthSchedules = useMemo(() => {
    const y = monthDate.getFullYear(), m = monthDate.getMonth();
    return schedules.filter(s => {
      if (!s.scheduled_date) return false;
      const d = new Date(s.scheduled_date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [schedules, monthDate]);

  const monthStats = useMemo(() => {
    const total = monthSchedules.length;
    const done = monthSchedules.filter(s => s.status === 'done' || s.status === 'completed').length;
    const overdue = monthSchedules.filter(s => s.status === 'overdue').length;
    return { total, done, overdue };
  }, [monthSchedules]);

  function prevMonth() {
    const d = new Date(monthDate); d.setMonth(d.getMonth() - 1);
    const p = n => String(n).padStart(2, '0');
    setMonth(`${d.getFullYear()}-${p(d.getMonth() + 1)}`);
  }
  function nextMonth() {
    const d = new Date(monthDate); d.setMonth(d.getMonth() + 1);
    const p = n => String(n).padStart(2, '0');
    setMonth(`${d.getFullYear()}-${p(d.getMonth() + 1)}`);
  }

  const checklist = Array.isArray(plan?.checklist) ? plan.checklist : [];

  return (
    <>
      <Head>
        <title>{plan?.title ? `${plan.title} | PM` : 'PM 계획'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/pm/plans" style={S.back}>←</Link>
          <h1 style={S.title}>{plan?.title || 'PM 계획'}</h1>
        </header>

        <div style={S.tabs}>
          {[['overview','개요'],['schedule','일정'],['logs','작업일지']].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)} style={tab===k ? S.tabActive : S.tab}>{l}</button>
          ))}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}
        {loading && <div style={S.loading}>불러오는 중…</div>}

        {!loading && tab === 'overview' && plan && (
          <section style={S.section}>
            <div style={S.card}>
              <div style={S.kvRow}><span style={S.k}>계획명</span><span style={S.v}>{plan.title}</span></div>
              <div style={S.kvRow}>
                <span style={S.k}>설비</span>
                <span style={S.v}>
                  {asset ? `${asset.machine_asset_number || '—'} · ${asset.name_en || asset.name_ko || ''}` : '—'}
                </span>
              </div>
              <div style={S.kvRow}>
                <span style={S.k}>주기</span>
                <span style={S.v}>{plan.frequency_days}일 ({FREQ_LABEL[plan.frequency_label] || plan.frequency_label || '-'})</span>
              </div>
              <div style={S.kvRow}>
                <span style={S.k}>상태</span>
                <span style={S.v}>{plan.is_active ? '활성' : '비활성'}</span>
              </div>
              {plan.description && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                  {plan.description}
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>이번 달 이행률</div>
              <PMComplianceBar done={monthStats.done} total={monthStats.total} />
              {monthStats.overdue > 0 && (
                <div style={S.overdueLine}>⚠️ 연체 {monthStats.overdue}건</div>
              )}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>체크리스트 ({checklist.length})</div>
              {checklist.length === 0 ? (
                <div style={S.muted}>항목 없음</div>
              ) : (
                <ul style={S.checklist}>
                  {checklist.map((c, i) => (
                    <li key={i} style={S.checkItem}>
                      <span style={S.checkNum}>{i + 1}</span>
                      <span>{typeof c === 'string' ? c : (c.label || c.title || c.text || JSON.stringify(c))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {!loading && tab === 'schedule' && (
          <section style={S.section}>
            <div style={S.monthBar}>
              <button onClick={prevMonth} style={S.monthBtn}>‹</button>
              <span style={S.monthText}>{month}</span>
              <button onClick={nextMonth} style={S.monthBtn}>›</button>
            </div>
            <ScheduleTimeline schedules={monthSchedules} month={month} />
            <div style={{ marginTop: 12 }}>
              <div style={S.cardTitle}>해당 월 일정 ({monthSchedules.length})</div>
              {monthSchedules.length === 0 ? (
                <div style={S.muted}>일정 없음</div>
              ) : (
                <ul style={S.schedList}>
                  {monthSchedules.map(s => (
                    <li key={s.id} style={S.schedItem}>
                      <Link href={`/pm/log/${s.id}`} style={S.schedLink}>
                        <span style={S.schedDate}>{s.scheduled_date}</span>
                        <span style={{ ...S.schedStatus, ...statusStyle(s.status) }}>{statusLabel(s.status)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {!loading && tab === 'logs' && (
          <section style={S.section}>
            <WorkLogList logs={logs} />
          </section>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function statusLabel(s) {
  return { pending:'예정', done:'완료', completed:'완료', overdue:'연체', skipped:'건너뜀', in_progress:'진행중' }[s] || s || '';
}
function statusStyle(s) {
  const map = {
    pending:    { color: '#93c5fd', background: 'rgba(59,130,246,0.18)' },
    done:       { color: '#86efac', background: 'rgba(34,197,94,0.18)' },
    completed:  { color: '#86efac', background: 'rgba(34,197,94,0.18)' },
    overdue:    { color: '#fca5a5', background: 'rgba(239,68,68,0.18)' },
    skipped:    { color: '#94a3b8', background: 'rgba(100,116,139,0.2)' },
    in_progress:{ color: '#fcd34d', background: 'rgba(245,158,11,0.18)' },
  };
  return map[s] || {};
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', maxWidth: 480, margin: '0 auto', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  back: { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textDecoration: 'none', fontSize: 22, borderRadius: 8 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tabs: { display: 'flex', borderBottom: '1px solid #334155' },
  tab: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid transparent' },
  tabActive: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#f1f5f9', fontSize: 13, fontWeight: 800, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid #3b82f6' },
  section: { padding: '12px 14px' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 },
  kvRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px dashed rgba(148,163,184,0.15)', fontSize: 13 },
  k: { color: '#94a3b8' },
  v: { color: '#f1f5f9', textAlign: 'right', flex: 1 },
  muted: { color: '#64748b', fontSize: 13 },
  checklist: { listStyle: 'none', margin: 0, padding: 0 },
  checkItem: { display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px dashed rgba(148,163,184,0.15)', fontSize: 13, color: '#cbd5e1' },
  checkNum: { width: 22, height: 22, borderRadius: '50%', background: '#0b1220', border: '1px solid #334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8', flexShrink: 0 },
  overdueLine: { marginTop: 10, color: '#fca5a5', fontSize: 12 },
  monthBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10 },
  monthBtn: { width: 44, height: 44, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
  monthText: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', fontFamily: 'ui-monospace,Menlo,monospace' },
  schedList: { listStyle: 'none', margin: 0, padding: 0 },
  schedItem: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, marginBottom: 6 },
  schedLink: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', textDecoration: 'none', color: 'inherit' },
  schedDate: { fontSize: 13, color: '#f1f5f9', fontFamily: 'ui-monospace,Menlo,monospace' },
  schedStatus: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10 },
};
