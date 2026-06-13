import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';

// ── Inline dark theme matches /bm/index.js ─────────────────────────────
const PAGE_BG = '#0f172a';
const CARD_BG = '#1e293b';
const BORDER  = 'rgba(148,163,184,0.25)';
const TEXT    = '#e2e8f0';
const SUBTEXT = '#94a3b8';
const ACCENT  = '#38bdf8';

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  planning:  { bg: 'rgba(56,189,248,0.18)', fg: '#7dd3fc', label: '계획' },
  ongoing:   { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', label: '진행중' },
  completed: { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', label: '완료' },
  cancelled: { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', label: '취소' },
};

const FILTERS = [
  { key: 'all',       label: '전체' },
  { key: 'planning',  label: '계획' },
  { key: 'ongoing',   label: '진행중' },
  { key: 'completed', label: '완료' },
];

interface TravelRecord {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  country: string | null;
  status: string;
  total_distance_km: number | null;
  total_cost_inr: number | null;
  total_cost_krw: number | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data?.session?.access_token;
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export default function TravelRecordsListPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();
  const [items, setItems] = useState<TravelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', start_date: '', end_date: '', country: 'India', description: '' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const h = await authHeaders();
      const url = new URL('/api/travel/records', window.location.origin);
      if (filter !== 'all') url.searchParams.set('status', filter);
      if (q.trim()) url.searchParams.set('q', q.trim());
      const r = await fetch(url.toString(), { headers: h });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'load failed');
      setItems(j.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) { router.push('/login?next=/travel/records'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthed, filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.start_date || !form.end_date) {
      setError('제목/시작일/종료일을 입력하세요');
      return;
    }
    setCreating(true);
    try {
      const h = await authHeaders();
      const r = await fetch('/api/travel/records', { method: 'POST', headers: h, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'create failed');
      setShowNew(false);
      setForm({ title: '', start_date: '', end_date: '', country: 'India', description: '' });
      router.push(`/travel/records/${j.item.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  const visible = items.filter(it => !q.trim() || it.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <Head><title>Travel Records | DSC FMS</title></Head>
      <div style={{ minHeight: '100vh', background: PAGE_BG, color: TEXT, paddingBottom: 80 }}>
        <header style={{ padding: '16px', borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PAGE_BG, zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>출장 기록</h1>
            <button onClick={() => setShowNew(true)} style={btnPrimary}>+ 새 출장</button>
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="제목 검색..."
            style={{ ...inputStyle, marginTop: 12 }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  ...tabBtn,
                  background: filter === f.key ? ACCENT : 'transparent',
                  color: filter === f.key ? '#0f172a' : TEXT,
                  borderColor: filter === f.key ? ACCENT : BORDER,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>

        <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={errBox}>{error}</div>}
          {loading && <div style={{ color: SUBTEXT, padding: 16, textAlign: 'center' }}>로딩 중...</div>}
          {!loading && visible.length === 0 && (
            <div style={{ color: SUBTEXT, padding: 32, textAlign: 'center' }}>출장 기록이 없습니다</div>
          )}
          {visible.map(it => {
            const pill = STATUS_PILL[it.status] || STATUS_PILL.planning;
            return (
              <Link key={it.id} href={`/travel/records/${it.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{it.title}</div>
                      <div style={{ fontSize: 13, color: SUBTEXT }}>
                        {it.start_date} ~ {it.end_date} · {it.country || '-'}
                      </div>
                    </div>
                    <span style={{ ...statusPillStyle, background: pill.bg, color: pill.fg }}>{pill.label}</span>
                  </div>
                  {(it.total_distance_km || it.total_cost_inr) ? (
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: SUBTEXT }}>
                      {it.total_distance_km ? <span>{it.total_distance_km} km</span> : null}
                      {it.total_cost_inr ? <span>₹ {Number(it.total_cost_inr).toLocaleString()}</span> : null}
                      {it.total_cost_krw ? <span>₩ {Number(it.total_cost_krw).toLocaleString()}</span> : null}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </main>

        {showNew && (
          <div style={modalOverlay} onClick={() => setShowNew(false)}>
            <form style={modalBody} onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
              <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>새 출장 기록</h3>
              <label style={lbl}>제목 *</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>시작일 *</label>
                  <input style={inputStyle} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>종료일 *</label>
                  <input style={inputStyle} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
                </div>
              </div>
              <label style={lbl}>국가</label>
              <input style={inputStyle} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
              <label style={lbl}>설명</label>
              <textarea style={{ ...inputStyle, minHeight: 80 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => setShowNew(false)} style={btnSecondary}>취소</button>
                <button type="submit" disabled={creating} style={{ ...btnPrimary, flex: 1 }}>{creating ? '생성 중...' : '생성'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

// ── inline styles ─────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  background: ACCENT, color: '#0f172a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 14, minHeight: 44, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', fontWeight: 500, fontSize: 14, minHeight: 44, cursor: 'pointer',
};
const tabBtn: React.CSSProperties = {
  padding: '8px 14px', border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 36,
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: '#0b1220', color: TEXT, border: `1px solid ${BORDER}`,
  borderRadius: 8, padding: '10px 12px', fontSize: 16, outline: 'none',
};
const statusPillStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
};
const errBox: React.CSSProperties = {
  background: 'rgba(220,38,38,0.18)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.6)', padding: 12, borderRadius: 8, fontSize: 13,
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: SUBTEXT, marginTop: 10, marginBottom: 4 };
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const modalBody: React.CSSProperties = {
  width: '100%', maxWidth: 480, background: CARD_BG, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, color: TEXT,
};
