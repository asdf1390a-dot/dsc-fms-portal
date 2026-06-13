import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';

// ── Theme tokens ─────────────────────────────────────────────────────
const PAGE_BG = '#0f172a';
const CARD_BG = '#1e293b';
const SOFT_BG = '#0b1220';
const BORDER  = 'rgba(148,163,184,0.25)';
const TEXT    = '#e2e8f0';
const SUBTEXT = '#94a3b8';
const ACCENT  = '#38bdf8';
const SUCCESS = '#22c55e';
const DANGER  = '#dc2626';
const WARN    = '#f59e0b';

const TABS = [
  { key: 'overview',  label: '개요' },
  { key: 'schedule',  label: '일정' },
  { key: 'costs',     label: '비용' },
  { key: 'checklist', label: '체크리스트' },
] as const;
type TabKey = typeof TABS[number]['key'];

// ── Types matching the API ─────────────────────────────────────────────
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
interface Schedule {
  id: string; travel_id: string; date: string; event_name: string; location: string;
  description: string | null; start_time: string | null; end_time: string | null; sort_order: number;
}
interface Cost {
  id: string; travel_id: string; cost_type: string; description: string | null;
  amount: number; currency: string; date: string; is_approved: boolean; receipt_url: string | null;
}
interface Checklist {
  id: string; travel_id: string; title: string; category: string; priority: string;
  description: string | null; is_done: boolean; sort_order: number;
}
interface Participant {
  id: string; travel_id: string; display_name: string; employee_id: string | null; role: string; user_id: string | null;
}
interface CostSplit {
  id: string; cost_id: string; participant_id: string; share_amount: number; is_paid: boolean;
}

interface DetailPayload {
  item: TravelRecord;
  schedules: Schedule[];
  costs: Cost[];
  routes: any[];
  documents: any[];
  checklist: Checklist[];
  participants: Participant[];
  cost_splits: CostSplit[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data?.session?.access_token;
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export default function TravelRecordDetailPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const tab = (typeof router.query.tab === 'string' ? router.query.tab : 'overview') as TabKey;

  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const h = await authHeaders();
      const r = await fetch(`/api/travel/records/${id}`, { headers: h });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'load failed');
      setData(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) { router.push(`/login?next=/travel/records/${id}`); return; }
    load();
  }, [authLoading, isAuthed, id, load, router]);

  function switchTab(k: TabKey) {
    router.push({ pathname: `/travel/records/${id}`, query: { tab: k } }, undefined, { shallow: true });
  }

  return (
    <>
      <Head><title>{data?.item?.title || 'Travel'} | DSC FMS</title></Head>
      <div style={{ minHeight: '100vh', background: PAGE_BG, color: TEXT, paddingBottom: 80 }}>
        <header style={{ padding: 16, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PAGE_BG, zIndex: 5 }}>
          <Link href="/travel/records" style={{ color: SUBTEXT, fontSize: 13, textDecoration: 'none' }}>← 목록으로</Link>
          <h1 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700 }}>
            {loading ? '...' : (data?.item?.title || '—')}
          </h1>
          {data?.item && (
            <div style={{ fontSize: 12, color: SUBTEXT, marginTop: 4 }}>
              {data.item.start_date} ~ {data.item.end_date} · {data.item.country || '-'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 14, overflowX: 'auto' }}>
            {TABS.map(t => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => switchTab(t.key)}
                  style={{
                    padding: '10px 14px', minHeight: 40, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${active ? ACCENT : BORDER}`,
                    background: active ? ACCENT : 'transparent',
                    color: active ? '#0f172a' : TEXT,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </header>

        <main style={{ padding: 16 }}>
          {error && <div style={errBox}>{error}</div>}
          {loading && <div style={{ color: SUBTEXT, padding: 16, textAlign: 'center' }}>로딩 중...</div>}
          {!loading && data && (
            <>
              {tab === 'overview'  && <OverviewSection data={data} onReload={load} />}
              {tab === 'schedule'  && <ScheduleSection data={data} onReload={load} />}
              {tab === 'costs'     && <CostsSection data={data} onReload={load} />}
              {tab === 'checklist' && <ChecklistSection data={data} onReload={load} />}
            </>
          )}
        </main>
      </div>
    </>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────
function OverviewSection({ data, onReload }: { data: DetailPayload; onReload: () => void }) {
  const r = data.item;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: r.title, description: r.description || '', country: r.country || '',
    start_date: r.start_date, end_date: r.end_date, status: r.status,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const days = useMemo(() => {
    const s = new Date(r.start_date).getTime();
    const e = new Date(r.end_date).getTime();
    return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
  }, [r.start_date, r.end_date]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const h = await authHeaders();
      const res = await fetch(`/api/travel/records/${r.id}`, { method: 'PUT', headers: h, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'save failed');
      setEditing(false);
      onReload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm('이 출장 기록을 삭제할까요? 모든 하위 데이터가 함께 삭제됩니다.')) return;
    const h = await authHeaders();
    const res = await fetch(`/api/travel/records/${r.id}`, { method: 'DELETE', headers: h });
    if (res.ok) window.location.href = '/travel/records';
    else alert('삭제 실패');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>기본 정보</strong>
          {!editing ? (
            <button style={linkBtn} onClick={() => setEditing(true)}>수정</button>
          ) : (
            <button style={linkBtn} onClick={() => { setEditing(false); setErr(null); }}>취소</button>
          )}
        </div>
        {err && <div style={errBox}>{err}</div>}
        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <KV k="제목" v={r.title} />
            <KV k="설명" v={r.description || '—'} />
            <KV k="국가" v={r.country || '—'} />
            <KV k="기간" v={`${r.start_date} ~ ${r.end_date} (${days}일)`} />
            <KV k="상태" v={r.status} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={lbl}>제목</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <label style={lbl}>설명</label>
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <label style={lbl}>국가</label>
            <input style={inputStyle} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>시작일</label>
                <input style={inputStyle} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>종료일</label>
                <input style={inputStyle} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <label style={lbl}>상태</label>
            <select style={inputStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="planning">계획</option>
              <option value="ongoing">진행중</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
            <button onClick={save} disabled={saving} style={{ ...btnPrimary, marginTop: 8 }}>{saving ? '저장 중...' : '저장'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Stat label="일정" value={data.schedules.length} />
        <Stat label="비용" value={data.costs.length} />
        <Stat label="체크리스트" value={`${data.checklist.filter(c => c.is_done).length}/${data.checklist.length}`} />
      </div>

      <ParticipantsManager travelId={r.id} participants={data.participants} onReload={onReload} />

      <button onClick={remove} style={{ ...btnSecondary, color: '#fca5a5', borderColor: 'rgba(220,38,38,0.5)' }}>출장 기록 삭제</button>
    </div>
  );
}

// ── SCHEDULE ──────────────────────────────────────────────────────────
function ScheduleSection({ data, onReload }: { data: DetailPayload; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: data.item.start_date, event_name: '', location: '', start_time: '', end_time: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const h = await authHeaders();
      const r = await fetch(`/api/travel/records/${data.item.id}/schedules`, { method: 'POST', headers: h, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'add failed');
      setShowForm(false);
      setForm({ date: data.item.start_date, event_name: '', location: '', start_time: '', end_time: '', description: '' });
      onReload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function del(sid: string) {
    if (!confirm('일정을 삭제할까요?')) return;
    const h = await authHeaders();
    const r = await fetch(`/api/travel/records/${data.item.id}/schedules?sid=${sid}`, { method: 'DELETE', headers: h });
    if (r.ok) onReload(); else alert('삭제 실패');
  }

  // Group by date
  const groups = useMemo(() => {
    const m = new Map<string, Schedule[]>();
    for (const s of data.schedules) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.schedules]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!showForm && <button onClick={() => setShowForm(true)} style={btnPrimary}>+ 일정 추가</button>}
      {showForm && (
        <form onSubmit={add} style={card}>
          {err && <div style={errBox}>{err}</div>}
          <label style={lbl}>날짜 *</label>
          <input style={inputStyle} type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <label style={lbl}>제목 *</label>
          <input style={inputStyle} required value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} placeholder="HQ 미팅" />
          <label style={lbl}>장소 *</label>
          <input style={inputStyle} required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Chennai" />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>시작</label>
              <input style={inputStyle} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>종료</label>
              <input style={inputStyle} type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <label style={lbl}>설명</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>취소</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1 }}>{saving ? '추가 중...' : '추가'}</button>
          </div>
        </form>
      )}

      {groups.length === 0 && <div style={{ color: SUBTEXT, padding: 24, textAlign: 'center' }}>일정이 없습니다</div>}
      {groups.map(([date, items]) => (
        <div key={date}>
          <div style={{ color: ACCENT, fontSize: 13, fontWeight: 600, margin: '4px 0 6px' }}>{date}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(s => (
              <div key={s.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{s.event_name}</div>
                    <div style={{ color: SUBTEXT, fontSize: 13 }}>
                      📍 {s.location}{s.start_time ? ` · ⏰ ${s.start_time}${s.end_time ? `–${s.end_time}` : ''}` : ''}
                    </div>
                    {s.description && <div style={{ color: SUBTEXT, fontSize: 13, marginTop: 4 }}>{s.description}</div>}
                  </div>
                  <button onClick={() => del(s.id)} style={iconBtn}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── COSTS ─────────────────────────────────────────────────────────────
function CostsSection({ data, onReload }: { data: DetailPayload; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cost_type: 'meal', description: '', amount: '', currency: 'INR', date: data.item.start_date,
  });
  const [shareWith, setShareWith] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const participantsById = useMemo(() => {
    const m = new Map<string, Participant>();
    data.participants.forEach(p => m.set(p.id, p));
    return m;
  }, [data.participants]);

  const splitsByCost = useMemo(() => {
    const m = new Map<string, CostSplit[]>();
    for (const s of data.cost_splits) {
      if (!m.has(s.cost_id)) m.set(s.cost_id, []);
      m.get(s.cost_id)!.push(s);
    }
    return m;
  }, [data.cost_splits]);

  // Per-participant tally (sum of shares)
  const tally = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.cost_splits) {
      m.set(s.participant_id, (m.get(s.participant_id) || 0) + Number(s.share_amount));
    }
    return m;
  }, [data.cost_splits]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const h = await authHeaders();
      const body: any = { ...form, amount: Number(form.amount) };
      if (shareWith.size > 0) body.participant_ids = Array.from(shareWith);
      const r = await fetch(`/api/travel/records/${data.item.id}/costs`, { method: 'POST', headers: h, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'add failed');
      setShowForm(false);
      setShareWith(new Set());
      setForm({ cost_type: 'meal', description: '', amount: '', currency: 'INR', date: data.item.start_date });
      onReload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function del(cid: string) {
    if (!confirm('비용을 삭제할까요?')) return;
    const h = await authHeaders();
    const r = await fetch(`/api/travel/records/${data.item.id}/costs?cid=${cid}`, { method: 'DELETE', headers: h });
    if (r.ok) onReload(); else alert('삭제 실패');
  }

  const totalsByCcy = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of data.costs) m[c.currency] = (m[c.currency] || 0) + Number(c.amount);
    return m;
  }, [data.costs]);

  function toggleShare(id: string) {
    setShareWith(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={card}>
        <strong style={{ display: 'block', marginBottom: 8 }}>합계</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 14 }}>
          {Object.keys(totalsByCcy).length === 0 && <span style={{ color: SUBTEXT }}>비용 없음</span>}
          {Object.entries(totalsByCcy).map(([ccy, amt]) => (
            <span key={ccy}><span style={{ color: SUBTEXT }}>{ccy}</span> <strong>{amt.toLocaleString()}</strong></span>
          ))}
        </div>
        {data.participants.length > 0 && (
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: SUBTEXT, marginBottom: 6 }}>참여자별 부담액</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.participants.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{p.display_name}{p.role === 'organizer' ? ' ⭐' : ''}</span>
                  <span style={{ color: TEXT, fontWeight: 600 }}>{(tally.get(p.id) || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!showForm && <button onClick={() => setShowForm(true)} style={btnPrimary}>+ 비용 추가</button>}
      {showForm && (
        <form onSubmit={add} style={card}>
          {err && <div style={errBox}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>유형</label>
              <select style={inputStyle} value={form.cost_type} onChange={e => setForm({ ...form, cost_type: e.target.value })}>
                <option value="flight">항공</option>
                <option value="hotel">숙박</option>
                <option value="meal">식사</option>
                <option value="transport">교통</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>날짜 *</label>
              <input style={inputStyle} type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 2 }}>
              <label style={lbl}>금액 *</label>
              <input style={inputStyle} type="number" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>통화</label>
              <select style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="INR">INR</option>
                <option value="KRW">KRW</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <label style={lbl}>설명</label>
          <input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

          {data.participants.length > 0 && (
            <>
              <label style={lbl}>분담 대상 (선택 시 균등 분할)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.participants.map(p => {
                  const on = shareWith.has(p.id);
                  return (
                    <button type="button" key={p.id} onClick={() => toggleShare(p.id)} style={{
                      padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                      border: `1px solid ${on ? ACCENT : BORDER}`,
                      background: on ? ACCENT : 'transparent',
                      color: on ? '#0f172a' : TEXT,
                    }}>
                      {p.display_name}
                    </button>
                  );
                })}
              </div>
              {shareWith.size > 0 && form.amount && (
                <div style={{ color: SUBTEXT, fontSize: 12, marginTop: 6 }}>
                  1인 부담: {(Number(form.amount) / shareWith.size).toFixed(2)} {form.currency}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>취소</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1 }}>{saving ? '추가 중...' : '추가'}</button>
          </div>
        </form>
      )}

      {data.costs.length === 0 && <div style={{ color: SUBTEXT, padding: 24, textAlign: 'center' }}>비용이 없습니다</div>}
      {data.costs.map(c => {
        const splits = splitsByCost.get(c.id) || [];
        return (
          <div key={c.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{costTypeLabel(c.cost_type)}{c.description ? ` · ${c.description}` : ''}</div>
                <div style={{ color: SUBTEXT, fontSize: 13 }}>{c.date}</div>
                {splits.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: SUBTEXT }}>
                    분담: {splits.map(s => {
                      const p = participantsById.get(s.participant_id);
                      return p ? `${p.display_name} (${Number(s.share_amount).toLocaleString()})` : '?';
                    }).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{Number(c.amount).toLocaleString()} {c.currency}</div>
                <button onClick={() => del(c.id)} style={iconBtn}>삭제</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function costTypeLabel(t: string) {
  return ({ flight: '항공', hotel: '숙박', meal: '식사', transport: '교통', other: '기타' } as Record<string, string>)[t] || t;
}

// ── CHECKLIST ─────────────────────────────────────────────────────────
function ChecklistSection({ data, onReload }: { data: DetailPayload; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'documents', priority: 'medium', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const h = await authHeaders();
      const r = await fetch(`/api/travel/records/${data.item.id}/checklist`, { method: 'POST', headers: h, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'add failed');
      setShowForm(false);
      setForm({ title: '', category: 'documents', priority: 'medium', description: '' });
      onReload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function toggle(item: Checklist) {
    const h = await authHeaders();
    const r = await fetch(`/api/travel/records/${data.item.id}/checklist?iid=${item.id}`, {
      method: 'PATCH', headers: h, body: JSON.stringify({ is_done: !item.is_done }),
    });
    if (r.ok) onReload(); else alert('업데이트 실패');
  }

  async function del(iid: string) {
    if (!confirm('항목을 삭제할까요?')) return;
    const h = await authHeaders();
    const r = await fetch(`/api/travel/records/${data.item.id}/checklist?iid=${iid}`, { method: 'DELETE', headers: h });
    if (r.ok) onReload(); else alert('삭제 실패');
  }

  const done = data.checklist.filter(c => c.is_done).length;
  const total = data.checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <strong>진행률</strong>
          <span style={{ color: SUBTEXT, fontSize: 13 }}>{done} / {total} ({pct}%)</span>
        </div>
        <div style={{ background: SOFT_BG, height: 8, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: SUCCESS, height: '100%', width: `${pct}%`, transition: 'width 0.2s' }} />
        </div>
      </div>

      {!showForm && <button onClick={() => setShowForm(true)} style={btnPrimary}>+ 항목 추가</button>}
      {showForm && (
        <form onSubmit={add} style={card}>
          {err && <div style={errBox}>{err}</div>}
          <label style={lbl}>제목 *</label>
          <input style={inputStyle} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>분류</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="documents">서류</option>
                <option value="packing">짐</option>
                <option value="booking">예약</option>
                <option value="health">건강</option>
                <option value="general">기타</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>우선순위</label>
              <select style={inputStyle} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
          </div>
          <label style={lbl}>설명</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>취소</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1 }}>{saving ? '추가 중...' : '추가'}</button>
          </div>
        </form>
      )}

      {total === 0 && <div style={{ color: SUBTEXT, padding: 24, textAlign: 'center' }}>체크리스트가 비어있습니다</div>}
      {data.checklist.map(item => {
        const pri = item.priority === 'high' ? DANGER : item.priority === 'medium' ? WARN : SUBTEXT;
        return (
          <div key={item.id} style={{ ...card, borderLeft: `4px solid ${pri}`, opacity: item.is_done ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={item.is_done} onChange={() => toggle(item)} style={{ width: 22, height: 22, marginTop: 2, cursor: 'pointer' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, textDecoration: item.is_done ? 'line-through' : 'none' }}>{item.title}</div>
                <div style={{ color: SUBTEXT, fontSize: 12 }}>{categoryLabel(item.category)}</div>
                {item.description && <div style={{ color: SUBTEXT, fontSize: 13, marginTop: 4 }}>{item.description}</div>}
              </div>
              <button onClick={() => del(item.id)} style={iconBtn}>삭제</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function categoryLabel(c: string) {
  return ({ documents: '서류', packing: '짐', booking: '예약', health: '건강', general: '기타' } as Record<string, string>)[c] || c;
}

// ── PARTICIPANTS (used inside Overview) ────────────────────────────────
function ParticipantsManager({ travelId, participants, onReload }: { travelId: string; participants: Participant[]; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ display_name: '', employee_id: '', role: 'member' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const h = await authHeaders();
      const r = await fetch(`/api/travel/records/${travelId}/participants`, { method: 'POST', headers: h, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'add failed');
      setShowForm(false);
      setForm({ display_name: '', employee_id: '', role: 'member' });
      onReload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function del(pid: string) {
    if (!confirm('참여자를 제거할까요?')) return;
    const h = await authHeaders();
    const r = await fetch(`/api/travel/records/${travelId}/participants?pid=${pid}`, { method: 'DELETE', headers: h });
    if (r.ok) onReload(); else alert('삭제 실패');
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>참여자 ({participants.length})</strong>
        {!showForm && <button style={linkBtn} onClick={() => setShowForm(true)}>+ 추가</button>}
      </div>
      {showForm && (
        <form onSubmit={add} style={{ marginBottom: 12 }}>
          {err && <div style={errBox}>{err}</div>}
          <label style={lbl}>이름 *</label>
          <input style={inputStyle} required value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>사번</label>
              <input style={inputStyle} value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>역할</label>
              <select style={inputStyle} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="organizer">주최자</option>
                <option value="member">참가자</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>취소</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1 }}>{saving ? '추가 중...' : '추가'}</button>
          </div>
        </form>
      )}
      {participants.length === 0 && <div style={{ color: SUBTEXT, fontSize: 13 }}>참여자가 없습니다</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {participants.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: SOFT_BG, padding: '8px 10px', borderRadius: 6 }}>
            <div>
              <div style={{ fontSize: 14 }}>{p.display_name}{p.role === 'organizer' ? ' ⭐' : ''}</div>
              {p.employee_id && <div style={{ fontSize: 11, color: SUBTEXT }}>{p.employee_id}</div>}
            </div>
            <button onClick={() => del(p.id)} style={iconBtn}>제거</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── helpers / styles ──────────────────────────────────────────────────
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ color: SUBTEXT, fontSize: 12 }}>{k}</div>
      <div style={{ fontSize: 14 }}>{v}</div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ color: SUBTEXT, fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14,
};
const btnPrimary: React.CSSProperties = {
  background: ACCENT, color: '#0f172a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 14, minHeight: 44, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', fontWeight: 500, fontSize: 14, minHeight: 44, cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: SOFT_BG, color: TEXT, border: `1px solid ${BORDER}`,
  borderRadius: 8, padding: '10px 12px', fontSize: 16, outline: 'none',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: SUBTEXT, marginTop: 8, marginBottom: 4 };
const linkBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: ACCENT, fontSize: 13, cursor: 'pointer', padding: 4 };
const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#fca5a5', fontSize: 12, cursor: 'pointer', padding: 4 };
const errBox: React.CSSProperties = {
  background: 'rgba(220,38,38,0.18)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.6)', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8,
};
