import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import KpiInputRow from '../../components/kpi/KpiInputRow';
import KpiTargetRow from '../../components/kpi/KpiTargetRow';
import KpiSyncButton from '../../components/kpi/KpiSyncButton';

export default function KpiInputPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null); // null = unknown
  const [tab, setTab]   = useState('actuals'); // 'actuals' | 'targets'

  const initMonth = useMemo(() => {
    const q = router.query.month;
    if (q && /^\d{4}-\d{2}/.test(String(q))) {
      const [y, m] = String(q).split('-');
      return { year: Number(y), month: Number(m) };
    }
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [router.query.month]);

  const [year, setYear]   = useState(initMonth.year);
  const [month, setMonth] = useState(initMonth.month);
  useEffect(() => { setYear(initMonth.year); setMonth(initMonth.month); }, [initMonth.year, initMonth.month]);

  const targetMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthLabel  = `${year}년 ${String(month).padStart(2, '0')}월`;

  const [items, setItems]     = useState([]);    // dashboard rows merged
  const [drafts, setDrafts]   = useState({});    // category_id → { actual_value, source_note }
  const [tgtDrafts, setTgtDrafts] = useState({}); // category_id → target_value
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [okMsg, setOkMsg]     = useState('');

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
    if (authLoading) return;
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles').select('role').eq('user_id', user.id).maybeSingle();
      if (!cancelled) setIsAdmin(data?.role === 'admin');
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  async function loadData() {
    setLoading(true);
    setError(null);
    setOkMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('not_authenticated');
      const r = await fetch(`/api/kpi/dashboard?month=${targetMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setItems(j.items || []);
      const d = {}, td = {};
      for (const it of (j.items || [])) {
        d[it.category_id]  = { actual_value: it.actual_value ?? '', source_note: it.source_note ?? '' };
        td[it.category_id] = it.target_value ?? '';
      }
      setDrafts(d);
      setTgtDrafts(td);
    } catch (e) {
      setError(e.message || 'load_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, targetMonth]);

  async function authedFetch(url, opts = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function saveAllActuals() {
    setSaving(true);
    setError(null);
    setOkMsg('');
    try {
      let saved = 0;
      for (const it of items) {
        if (it.is_auto) continue; // skip auto-managed
        const d = drafts[it.category_id];
        if (!d) continue;
        if (d.actual_value === '' || d.actual_value == null) continue;
        const r = await authedFetch('/api/kpi/actuals', {
          method: 'POST',
          body: JSON.stringify({
            category_id:  it.category_id,
            target_month: targetMonth,
            week_number:  null,
            actual_value: d.actual_value,
            source_note:  d.source_note || null,
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(`${it.label}: ${j.error || r.status}`);
        }
        saved++;
      }
      setOkMsg(`실적 ${saved}건 저장 완료`);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAllTargets() {
    setSaving(true);
    setError(null);
    setOkMsg('');
    try {
      let saved = 0;
      for (const it of items) {
        const v = tgtDrafts[it.category_id];
        if (v === '' || v == null) continue;
        const r = await authedFetch('/api/kpi/targets', {
          method: 'POST',
          body: JSON.stringify({
            category_id:  it.category_id,
            target_month: targetMonth,
            target_value: v,
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(`${it.label}: ${j.error || r.status}`);
        }
        saved++;
      }
      setOkMsg(`목표 ${saved}건 저장 완료`);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Access gate
  if (authLoading || isAdmin === null) {
    return (
      <>
        <Head><title>KPI 입력 | DSC FMS</title></Head>
        <main style={S.page}><div style={S.emptyText}>확인 중…</div></main>
        <BottomNav />
      </>
    );
  }
  if (!isAdmin) {
    return (
      <>
        <Head><title>KPI 입력 | DSC FMS</title></Head>
        <main style={S.page}>
          <header style={S.header}><h1 style={S.title}>KPI 입력</h1></header>
          <div style={S.errorBox}>접근 권한 없음 (admin 전용)</div>
          <div style={{ padding: 14 }}>
            <Link href="/kpi" style={S.backBtn}>← KPI 대시보드로</Link>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>KPI 입력 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/kpi" style={S.backBtn}>←</Link>
          <h1 style={S.title}>KPI 입력</h1>
          <div style={S.monthPicker}>
            <button onClick={prevMonth} style={S.monthBtn}>‹</button>
            <span style={S.monthLabel}>{monthLabel}</span>
            <button onClick={nextMonth} style={S.monthBtn}>›</button>
          </div>
        </header>

        <div style={S.tabBar}>
          <button onClick={() => setTab('actuals')} style={{ ...S.tab, ...(tab === 'actuals' ? S.tabActive : {}) }}>실적 입력</button>
          <button onClick={() => setTab('targets')} style={{ ...S.tab, ...(tab === 'targets' ? S.tabActive : {}) }}>목표 설정</button>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}
        {okMsg && <div style={S.okBox}>{okMsg}</div>}

        {loading && <div style={S.emptyText}>불러오는 중…</div>}

        {!loading && tab === 'actuals' && (
          <section style={S.section}>
            <div style={S.syncBar}>
              <KpiSyncButton month={targetMonth} onSynced={loadData} />
              <span style={S.hint}>MTTR/MTBF 자동 산출</span>
            </div>
            {items.map(it => (
              <KpiInputRow
                key={it.category_id}
                item={it}
                value={drafts[it.category_id]?.actual_value ?? ''}
                note={drafts[it.category_id]?.source_note ?? ''}
                onChangeValue={v => setDrafts(s => ({ ...s, [it.category_id]: { ...(s[it.category_id] || {}), actual_value: v } }))}
                onChangeNote={v  => setDrafts(s => ({ ...s, [it.category_id]: { ...(s[it.category_id] || {}), source_note:  v } }))}
              />
            ))}
            <button onClick={saveAllActuals} disabled={saving} style={S.saveBtn}>
              {saving ? '저장 중…' : '전체 저장'}
            </button>
          </section>
        )}

        {!loading && tab === 'targets' && (
          <section style={S.section}>
            {items.map(it => (
              <KpiTargetRow
                key={it.category_id}
                item={it}
                value={tgtDrafts[it.category_id] ?? ''}
                onChange={v => setTgtDrafts(s => ({ ...s, [it.category_id]: v }))}
              />
            ))}
            <button onClick={saveAllTargets} disabled={saving} style={S.saveBtn}>
              {saving ? '저장 중…' : '목표 저장'}
            </button>
          </section>
        )}
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page:    { fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header:  { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  title:   { fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc', flex: 1 },
  backBtn: { width: 36, height: 36, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' },
  monthPicker: { display: 'flex', alignItems: 'center', gap: 4 },
  monthBtn:    { width: 36, height: 36, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 18, cursor: 'pointer' },
  monthLabel:  { fontSize: 12, fontWeight: 700, color: '#f1f5f9', minWidth: 86, textAlign: 'center', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  tabBar:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid #1f2937' },
  tab:     { height: 44, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  tabActive: { color: '#ef4444', borderBottom: '2px solid #ef4444' },
  section: { padding: '12px 14px' },
  syncBar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  hint:    { fontSize: 11, color: '#64748b' },
  saveBtn: { width: '100%', height: 48, marginTop: 6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  okBox:   { margin: 14, padding: 12, background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 10, fontSize: 13 },
  emptyText: { padding: '24px 0', textAlign: 'center', color: '#475569', fontSize: 14 },
};
