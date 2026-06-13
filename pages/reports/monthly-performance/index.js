// 월간 경영실적 — 목록 (CEO 전용)
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';
import BottomNav from '../../../components/BottomNav';

export default function MonthlyPerformanceIndex() {
  const { user, isAuthed } = useAuth();
  const role = user?.user_metadata?.role || user?.app_metadata?.role;
  const isCeo = role === 'ceo' || role === 'admin';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function authedFetch(url, opts = {}) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
  }

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await authedFetch('/api/reports/monthly-performance');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'load failed');
      setItems(json.items || []);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (isAuthed) load(); else setLoading(false); }, [isAuthed]);

  async function generateCurrent() {
    setBusy(true);
    try {
      const now = new Date();
      const t = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const res = await authedFetch('/api/reports/monthly-performance/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: t.getFullYear(), month: t.getMonth() + 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'generate failed');
      await load();
    } catch (e) {
      alert('에러: ' + e.message);
    } finally { setBusy(false); }
  }

  if (!isAuthed) return <Gate text="로그인이 필요합니다." />;
  if (!isCeo)   return <Gate text="CEO 권한이 필요한 페이지입니다." />;

  return (
    <>
      <Head><title>월간 경영실적 | DSC FMS</title></Head>
      <div style={S.page}>
        <div style={S.wrap}>
          <h1 style={S.h1}>월간 경영실적</h1>
          <p style={S.sub}>월 1회 자동 생성 · CEO 전용</p>

          <button onClick={generateCurrent} disabled={busy} style={S.btn}>
            {busy ? '생성 중…' : '+ 전월 보고 생성/갱신'}
          </button>

          {loading && <div style={S.muted}>불러오는 중…</div>}
          {err && <div style={S.err}>에러: {err}</div>}

          <div style={S.list}>
            {items.map((it) => (
              <Link key={it.id} href={`/reports/monthly-performance/${it.year}/${it.month}`} style={S.card}>
                <div style={S.cardTop}>
                  <div style={S.cardTitle}>{it.year}년 {it.month}월</div>
                  <div style={S.arrow}>›</div>
                </div>
                <div style={S.cardMeta}>
                  <span style={it.is_auto ? S.tagAuto : S.tagManual}>
                    {it.is_auto ? '자동' : '수동'}
                  </span>
                  <span style={S.tagStatus}>{it.status}</span>
                  {it.has_file && <span style={S.tagFile}>첨부</span>}
                  <span style={S.metaTime}>{fmtTime(it.generated_at)}</span>
                </div>
              </Link>
            ))}
            {!loading && items.length === 0 && (
              <div style={S.empty}>아직 생성된 월간 보고가 없습니다.</div>
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    </>
  );
}

function Gate({ text }) {
  return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: 24, color: '#fca5a5' }}>{text}</div>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

const S = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingBottom: 80 },
  wrap: { maxWidth: 480, margin: '0 auto', padding: '16px 14px 0' },
  h1: { fontSize: 22, margin: '4px 0 4px', fontWeight: 800 },
  sub: { fontSize: 13, color: '#94a3b8', margin: '0 0 14px' },
  btn: {
    width: '100%', padding: '12px 14px', background: '#3b82f6', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
    minHeight: 44, cursor: 'pointer', marginBottom: 12,
  },
  muted: { marginTop: 12, color: '#94a3b8' },
  err: { marginTop: 12, color: '#fca5a5' },
  list: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  card: {
    display: 'block', textDecoration: 'none', color: '#f1f5f9',
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 12, padding: 14,
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: 700 },
  arrow: { fontSize: 22, color: '#64748b' },
  cardMeta: { display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' },
  tagAuto: { padding: '3px 8px', borderRadius: 999, fontSize: 11, background: 'rgba(34,197,94,0.18)', color: '#22c55e' },
  tagManual: { padding: '3px 8px', borderRadius: 999, fontSize: 11, background: 'rgba(59,130,246,0.18)', color: '#3b82f6' },
  tagStatus: { padding: '3px 8px', borderRadius: 999, fontSize: 11, background: '#33415588', color: '#cbd5e1' },
  tagFile: { padding: '3px 8px', borderRadius: 999, fontSize: 11, background: 'rgba(234,179,8,0.18)', color: '#eab308' },
  metaTime: { fontSize: 11, color: '#64748b', marginLeft: 'auto' },
  empty: { padding: 22, textAlign: 'center', color: '#64748b' },
};
