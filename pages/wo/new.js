import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const PRIORITY_OPTIONS = [
  { value: 'critical', label: '긴급', color: '#dc2626', activeBg: 'rgba(220,38,38,0.2)',  activeFg: '#fca5a5' },
  { value: 'high',     label: '높음', color: '#f97316', activeBg: 'rgba(249,115,22,0.2)', activeFg: '#fdba74' },
  { value: 'medium',   label: '보통', color: '#2563eb', activeBg: 'rgba(37,99,235,0.2)',  activeFg: '#93c5fd' },
  { value: 'low',      label: '낮음', color: '#64748b', activeBg: 'rgba(100,116,139,0.25)', activeFg: '#cbd5e1' },
];

function generateWoNumber() {
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  const yyyymmdd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `WO-${yyyymmdd}-${suffix}`;
}

export default function NewWorkOrderPage() {
  const router = useRouter();
  const { user, isAuthed, fullName, loading: authLoading } = useAuth();

  const [assets, setAssets] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // ── Auth gate ────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/wo/new')}`);
    }
  }, [authLoading, isAuthed, router]);

  // ── Load assets ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMaster(true);

      // Fetch all active assets with pagination
      const pageSize = 500;
      let allAssets = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && !cancelled) {
        const { data, error: fetchErr } = await supabase
          .from('assets')
          .select('id, machine_asset_number, name_en')
          .eq('status', 'active')
          .order('machine_asset_number')
          .range(offset, offset + pageSize - 1);

        if (fetchErr) {
          setError(fetchErr.message);
          setLoadingMaster(false);
          return;
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allAssets = allAssets.concat(data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }
      }

      if (cancelled) return;
      setAssets(allAssets);
      setLoadingMaster(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Pre-select asset from ?asset=DCMI-XXX ────────────────────────
  useEffect(() => {
    if (!router.query.asset || !assets.length) return;
    const tag = String(router.query.asset);
    const found = assets.find(x => x.machine_asset_number === tag);
    if (found) setAssetId(found.id);
  }, [router.query.asset, assets]);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('작업 제목을 입력하세요'); return; }
    setBusy(true);
    setError(null);
    try {
      const woNumber = generateWoNumber();
      const { error: insErr } = await supabase
        .from('work_orders')
        .insert({
          wo_number: woNumber,
          title: title.trim(),
          description: description.trim() || null,
          asset_id: assetId || null,
          priority,
          status: 'open',
          assigned_to: assignedTo.trim() || null,
          due_date: dueDate || null,
          estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
          created_by: fullName || user?.email || null,
        });
      if (insErr) throw insErr;

      await router.push('/wo');
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  const submitDisabled = !title.trim() || busy;

  return (
    <>
      <Head>
        <title>작업지시 등록 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/wo" style={S.backLink}>← WO</Link>
          <h1 style={S.title}>작업지시 등록</h1>
        </header>

        {authLoading || !isAuthed ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>…</div>
        ) : (
          <form onSubmit={submit} style={S.form}>
            <Section title="작업 제목 *">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 컨베이어 벨트 교체"
                style={S.input}
                required
              />
            </Section>

            <Section title="작업 내용">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="작업 상세 내용, 절차, 주의사항"
                style={{ ...S.input, height: 110, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Section>

            <Section title="관련 자산">
              <select
                value={assetId}
                onChange={e => setAssetId(e.target.value)}
                style={S.input}
                disabled={loadingMaster}
              >
                <option value="">{loadingMaster ? '불러오는 중…' : '— 자산 선택 (선택) —'}</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.machine_asset_number} — {a.name_en}
                  </option>
                ))}
              </select>
            </Section>

            <Section title="우선순위 *">
              <div style={S.priorityGrid}>
                {PRIORITY_OPTIONS.map(opt => {
                  const active = priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      style={{
                        ...S.priorityBtn,
                        borderColor: active ? opt.color : '#334155',
                        background: active ? opt.activeBg : '#0b1220',
                        color: active ? opt.activeFg : '#cbd5e1',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="담당자">
              <input
                type="text"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                placeholder="담당자 이름"
                style={S.input}
              />
            </Section>

            <Section title="기한">
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={S.input}
              />
            </Section>

            <Section title="예상 작업시간 (시간)">
              <input
                type="number"
                step="0.5"
                min="0"
                value={estimatedHours}
                onChange={e => setEstimatedHours(e.target.value)}
                placeholder="예: 2.5"
                style={S.input}
              />
            </Section>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.actions}>
              <button
                type="button"
                onClick={() => router.push('/wo')}
                style={{ ...S.btn, ...S.btnSecondary }}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                style={{
                  ...S.btn,
                  ...(submitDisabled ? S.btnDisabled : S.btnPrimary),
                }}
              >
                {busy ? '등록 중…' : '등록'}
              </button>
            </div>
          </form>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 4, padding: '16px 16px 8px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {children}
    </section>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 40 },
  title: { fontSize: 18, fontWeight: 700, flex: 1, margin: 0, color: '#f8fafc' },
  form: { paddingTop: 8 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 48 },
  priorityGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 },
  priorityBtn: { padding: '14px 6px', borderRadius: 10, border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700, minHeight: 52, transition: 'all 0.15s' },
  actions: { display: 'flex', gap: 10, padding: '16px 16px 0' },
  btn: { flex: 1, padding: '16px', borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', minHeight: 52 },
  btnSecondary: { background: '#334155', color: '#e2e8f0' },
  btnPrimary: { background: '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed', boxShadow: 'none' },
  error: { margin: '0 16px 16px', padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
};
