import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const GROUP_ORDER = ['생산', '품질', '보전', '안전'];

export default function KpiInputPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const monthIso = `${year}-${String(month).padStart(2, '0')}`;
  const targetMonth = `${monthIso}-01`;

  const [tab, setTab] = useState('actuals'); // 'actuals' | 'targets'
  const [items, setItems] = useState([]);
  const [actualMap, setActualMap] = useState({});  // {category_id: {value, note}}
  const [targetMap, setTargetMap] = useState({});  // {category_id: {value, note}}
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace(`/login?next=${encodeURIComponent('/kpi/input')}`);
  }, [authLoading, isAuthed, router]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kpi/dashboard?month=${monthIso}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'fetch failed');
      setItems(json.items || []);
      const am = {}, tm = {};
      for (const it of json.items) {
        am[it.category_id] = { value: it.actual_value != null ? String(it.actual_value) : '', note: '' };
        tm[it.category_id] = { value: it.target_value != null ? String(it.target_value) : '', note: '' };
      }
      setActualMap(am);
      setTargetMap(tm);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (isAuthed) load(); }, [monthIso, isAuthed]);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  }

  async function saveActuals() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const rows = Object.entries(actualMap)
        .filter(([_, v]) => v.value !== '' && v.value != null)
        .map(([cid, v]) => ({
          category_id: cid,
          target_month: targetMonth,
          actual_value: Number(v.value),
          note: v.note || null,
        }));
      if (rows.length === 0) { setError('입력된 항목이 없습니다'); return; }
      const res = await fetch('/api/kpi/actuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'save failed');
      setFlash('✓ 실적 저장 완료');
      await load();
      setTimeout(() => setFlash(null), 2500);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function saveTargets() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const rows = Object.entries(targetMap)
        .filter(([_, v]) => v.value !== '' && v.value != null)
        .map(([cid, v]) => ({
          category_id: cid,
          target_month: targetMonth,
          target_value: Number(v.value),
          note: v.note || null,
        }));
      if (rows.length === 0) { setError('입력된 항목이 없습니다'); return; }
      const res = await fetch('/api/kpi/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'save failed');
      setFlash('✓ 목표 저장 완료');
      await load();
      setTimeout(() => setFlash(null), 2500);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function syncAuto() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/kpi/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: monthIso }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'sync failed');
      setFlash('✓ BM 자동 동기화 완료');
      await load();
      setTimeout(() => setFlash(null), 2500);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function prevMonth() { if (month === 1) { setYear(y=>y-1); setMonth(12); } else setMonth(m=>m-1); }
  function nextMonth() { if (month === 12) { setYear(y=>y+1); setMonth(1); } else setMonth(m=>m+1); }

  const grouped = {};
  for (const it of items) {
    if (!grouped[it.group_name]) grouped[it.group_name] = [];
    grouped[it.group_name].push(it);
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
          <Link href="/kpi" style={S.backLink}>← KPI</Link>
          <h1 style={S.title}>KPI 입력</h1>
          <div style={{ minWidth: 40 }} />
        </header>

        <div style={S.monthBar}>
          <button onClick={prevMonth} style={S.monthBtn}>‹</button>
          <span style={S.monthLabel}>{year}년 {String(month).padStart(2,'0')}월</span>
          <button onClick={nextMonth} style={S.monthBtn}>›</button>
        </div>

        <div style={S.tabBar}>
          <button onClick={() => setTab('actuals')} style={tab==='actuals' ? S.tabActive : S.tab}>실적 입력</button>
          <button onClick={() => setTab('targets')} style={tab==='targets' ? S.tabActive : S.tab}>목표 설정</button>
        </div>

        {flash && <div style={S.flash}>{flash}</div>}
        {error && <div style={S.errorBox}>{error}</div>}

        {tab === 'actuals' && (
          <div style={S.syncRow}>
            <button onClick={syncAuto} disabled={busy} style={S.syncBtn}>🔄 BM 자동 동기화</button>
            <div style={S.hint}>MTTR/MTBF는 BM 이력에서 자동 집계됩니다 (수정 가능)</div>
          </div>
        )}

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : (
          GROUP_ORDER.map(g => grouped[g] ? (
            <section key={g} style={S.section}>
              <div style={S.sectionTitle}>{g}</div>
              {grouped[g].map(it => {
                const map = tab === 'actuals' ? actualMap : targetMap;
                const setMap = tab === 'actuals' ? setActualMap : setTargetMap;
                const v = map[it.category_id] || { value: '', note: '' };
                const otherVal = tab === 'actuals' ? it.target_value : it.actual_value;
                const otherLabel = tab === 'actuals' ? '목표' : '실적';
                return (
                  <div key={it.category_id} style={S.row}>
                    <div style={S.rowHeader}>
                      <span style={S.rowTitle}>{it.name_ko} ({it.unit})</span>
                      {it.is_auto && <span style={S.autoBadge}>🔄 자동</span>}
                    </div>
                    <div style={S.rowMeta}>{otherLabel}: {otherVal != null ? otherVal : '—'}</div>
                    <input
                      type="number"
                      step="any"
                      value={v.value}
                      onChange={e => setMap(m => ({ ...m, [it.category_id]: { ...m[it.category_id], value: e.target.value } }))}
                      placeholder={tab === 'actuals' ? '실적 입력' : '목표 입력'}
                      style={S.input}
                    />
                    {tab === 'actuals' && (
                      <input
                        type="text"
                        value={v.note}
                        onChange={e => setMap(m => ({ ...m, [it.category_id]: { ...m[it.category_id], note: e.target.value } }))}
                        placeholder="비고 (선택)"
                        style={{ ...S.input, marginTop: 6, fontSize: 14 }}
                      />
                    )}
                  </div>
                );
              })}
            </section>
          ) : null)
        )}

        <div style={S.actions}>
          <button
            type="button"
            onClick={tab === 'actuals' ? saveActuals : saveTargets}
            disabled={busy}
            style={busy ? S.btnDisabled : S.btnPrimary}
          >
            {busy ? '저장 중…' : (tab === 'actuals' ? '실적 전체 저장' : '목표 전체 저장')}
          </button>
        </div>
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
  monthBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '12px 16px', background: '#0b1220', borderBottom: '1px solid #1f2937' },
  monthBtn: { width: 44, height: 44, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 22, cursor: 'pointer' },
  monthLabel: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', minWidth: 120, textAlign: 'center', fontFamily: 'ui-monospace,Menlo,monospace' },
  tabBar: { display: 'flex', borderBottom: '1px solid #1f2937', background: '#0f172a', position: 'sticky', top: 65, zIndex: 15 },
  tab: { flex: 1, padding: '14px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid transparent' },
  tabActive: { flex: 1, padding: '14px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: 14, fontWeight: 800, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid #2563eb' },
  syncRow: { padding: '14px 14px 0' },
  syncBtn: { width: '100%', padding: '12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#fdba74', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  hint: { fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 1.4 },
  section: { padding: '14px 14px 4px' },
  sectionTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  row: { background: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #1f2937' },
  rowHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  rowTitle: { fontSize: 14, fontWeight: 700, color: '#f8fafc' },
  rowMeta: { fontSize: 11, color: '#64748b', marginBottom: 8, fontFamily: 'ui-monospace,Menlo,monospace' },
  autoBadge: { fontSize: 10, fontWeight: 800, color: '#fdba74', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', padding: '2px 6px', borderRadius: 6 },
  input: { width: '100%', padding: '11px 14px', border: '1px solid #334155', borderRadius: 8, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 44 },
  actions: { padding: '16px 14px 0' },
  btnPrimary: { width: '100%', padding: 16, borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 800, cursor: 'pointer', minHeight: 56, background: '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' },
  btnDisabled: { width: '100%', padding: 16, borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 800, cursor: 'not-allowed', minHeight: 56, background: '#1f2937', color: '#475569' },
  flash: { margin: '12px 14px 0', padding: 12, background: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 10, fontSize: 13, textAlign: 'center', fontWeight: 700 },
  errorBox: { margin: '12px 14px 0', padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
};
