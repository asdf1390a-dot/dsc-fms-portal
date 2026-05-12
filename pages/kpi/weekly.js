import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ISO week helpers ─────────────────────────────────────────────
function startOfWeek(d) {
  // 월요일 시작
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7); // exclusive
  return e;
}
function fmtDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function rateColor(rate) {
  if (rate == null) return '#94a3b8';
  if (rate >= 100) return '#22c55e';
  if (rate >= 90) return '#f59e0b';
  return '#ef4444';
}

export default function WeeklyKpiPage() {
  const router = useRouter();
  const { isAuthed, role, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin' || isAuthed;

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const weekEnd = useMemo(() => endOfWeek(weekStart), [weekStart]);
  const startStr = useMemo(() => fmtDate(weekStart), [weekStart]);
  const endStr = useMemo(() => fmtDate(weekEnd), [weekEnd]);
  const { year, week } = useMemo(() => isoWeekNumber(weekStart), [weekStart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: cats, error: ce } = await supabase
          .from('kpi_categories')
          .select('id, name, group_name, unit, direction')
          .order('group_name')
          .order('name');
        if (ce) throw ce;

        const { data: acts, error: ae } = await supabase
          .from('kpi_actuals')
          .select('id, category_id, period_date, actual_value')
          .gte('period_date', startStr)
          .lt('period_date', endStr);
        if (ae) throw ae;

        // 카테고리별 합계 (또는 평균은 unit별로 다르지만 일단 합계 패턴)
        const byCat = {};
        for (const a of (acts || [])) {
          if (!byCat[a.category_id]) byCat[a.category_id] = { sum: 0, count: 0, values: [] };
          byCat[a.category_id].sum += Number(a.actual_value) || 0;
          byCat[a.category_id].count += 1;
          byCat[a.category_id].values.push(a);
        }

        const merged = (cats || []).map(c => ({
          ...c,
          actual: byCat[c.id]?.sum ?? null,
          count: byCat[c.id]?.count ?? 0,
        }));
        if (!cancelled) setItems(merged);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startStr, endStr]);

  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7);
    setWeekStart(startOfWeek(d));
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7);
    setWeekStart(startOfWeek(d));
  }

  // 그룹화
  const grouped = useMemo(() => {
    const g = {};
    for (const it of items) {
      const key = it.group_name || '기타';
      if (!g[key]) g[key] = [];
      g[key].push(it);
    }
    return Object.entries(g);
  }, [items]);

  return (
    <>
      <Head>
        <title>주간 KPI | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/kpi" style={S.back}>←</Link>
          <h1 style={S.title}>주간 KPI</h1>
          {isAdmin && (
            <Link href={`/kpi/input?week=${startStr}`} style={S.inputBtn}>입력</Link>
          )}
        </header>

        <div style={S.weekBar}>
          <button onClick={prevWeek} style={S.weekBtn}>‹</button>
          <div style={S.weekLabel}>
            <div style={S.weekTitle}>{year}년 {week}주</div>
            <div style={S.weekRange}>{startStr} ~ {fmtDate(new Date(weekEnd.getTime() - 86400000))}</div>
          </div>
          <button onClick={nextWeek} style={S.weekBtn}>›</button>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}
        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : grouped.length === 0 ? (
          <div style={S.empty}>KPI 카테고리가 없습니다</div>
        ) : (
          <div style={S.section}>
            {grouped.map(([groupName, list]) => (
              <div key={groupName} style={{ marginBottom: 14 }}>
                <div style={S.groupTitle}>{groupName}</div>
                {list.map(it => (
                  <div key={it.id} style={S.card}>
                    <div style={S.cardHead}>
                      <span style={S.cardName}>{it.name}</span>
                      {it.unit && <span style={S.cardUnit}>{it.unit}</span>}
                    </div>
                    <div style={S.cardActual}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: rateColor(null) }}>
                        {it.actual != null ? Number(it.actual).toLocaleString() : '—'}
                      </span>
                      {it.count > 0 && (
                        <span style={S.cardCount}>({it.count}건)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', maxWidth: 480, margin: '0 auto', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  back: { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textDecoration: 'none', fontSize: 22, borderRadius: 8 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, color: '#f1f5f9' },
  inputBtn: { padding: '8px 14px', background: '#3b82f6', color: '#fff', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, minHeight: 36, display: 'inline-flex', alignItems: 'center' },
  weekBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px' },
  weekBtn: { width: 44, height: 44, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
  weekLabel: { flex: 1, textAlign: 'center' },
  weekTitle: { fontSize: 15, fontWeight: 700, color: '#f1f5f9' },
  weekRange: { fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace', marginTop: 2 },
  section: { padding: '0 14px 16px' },
  groupTitle: { fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, paddingLeft: 4 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  cardName: { fontSize: 14, fontWeight: 700, color: '#f1f5f9' },
  cardUnit: { fontSize: 11, color: '#94a3b8' },
  cardActual: { display: 'flex', alignItems: 'baseline', gap: 8 },
  cardCount: { fontSize: 11, color: '#94a3b8' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10 },
};
