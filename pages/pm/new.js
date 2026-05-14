import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const FREQ_OPTIONS = [
  { days: 1,   label: '1일 (매일)',  freqLabel: 'daily' },
  { days: 7,   label: '7일 (주간)',  freqLabel: 'weekly' },
  { days: 14,  label: '14일 (격주)', freqLabel: 'biweekly' },
  { days: 30,  label: '30일 (월간)', freqLabel: 'monthly' },
  { days: 90,  label: '90일 (분기)', freqLabel: 'quarterly' },
  { days: 180, label: '180일 (반기)', freqLabel: 'biannual' },
  { days: 365, label: '365일 (연간)', freqLabel: 'annual' },
];

const CATEGORY_OPTIONS = [
  { value: 'general',     label: '일반' },
  { value: 'lubrication', label: '윤활' },
  { value: 'inspection',  label: '점검' },
  { value: 'calibration', label: '교정' },
  { value: 'cleaning',    label: '청소' },
];

export default function NewPMPage() {
  const router = useRouter();
  const { user, isAuthed, loading: authLoading } = useAuth();

  const [assets, setAssets] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequencyDays, setFrequencyDays] = useState(30);
  const [category, setCategory] = useState('general');
  const [checklistItems, setChecklistItems] = useState([]); // [string]
  const [checklistInput, setChecklistInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // ── Auth gate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/pm/new')}`);
    }
  }, [authLoading, isAuthed, router]);

  // ── Load assets + set today as default start date ──────────────────
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

      const today = new Date();
      const pad = n => String(n).padStart(2, '0');
      setStartDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);

      setLoadingMaster(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Pre-select asset from ?asset=DCMI-XXX ──────────────────────────
  useEffect(() => {
    if (!router.query.asset || !assets.length) return;
    const tag = String(router.query.asset);
    const found = assets.find(x => x.machine_asset_number === tag);
    if (found) setAssetId(found.id);
  }, [router.query.asset, assets]);

  async function submit(e) {
    e.preventDefault();
    if (!assetId) { setError('자산을 선택하세요'); return; }
    if (!title.trim()) { setError('작업명을 입력하세요'); return; }
    setBusy(true);
    setError(null);
    try {
      const freqMeta = FREQ_OPTIONS.find(f => f.days === frequencyDays);
      const { data: plan, error: planErr } = await supabase
        .from('pm_plans')
        .insert({
          asset_id: assetId,
          title: title.trim(),
          description: description.trim() || null,
          frequency_days: frequencyDays,
          frequency_label: freqMeta?.freqLabel || null,
          category: category || 'general',
          checklist: checklistItems.map(item => ({ item, required: true })),
          estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
          is_active: true,
        })
        .select('id')
        .single();
      if (planErr) throw planErr;

      // Try RPC for bulk schedule generation; fall back to single insert.
      const rpcRes = await supabase.rpc('pm_generate_schedules', {
        p_plan_id: plan.id,
        p_start_date: startDate,
        p_count: 12,
      });
      if (rpcRes.error) {
        // Fallback to single schedule (if RPC not installed yet)
        await supabase.from('pm_schedules').insert({
          plan_id: plan.id, asset_id: assetId, scheduled_date: startDate, status: 'pending',
        });
      }

      await router.push('/pm');
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  const submitDisabled = !assetId || !title.trim() || busy;

  return (
    <>
      <Head>
        <title>PM 계획 등록 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/pm" style={S.backLink}>← PM</Link>
          <h1 style={S.title}>PM 계획 등록</h1>
        </header>

        {authLoading || !isAuthed ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>…</div>
        ) : (
          <form onSubmit={submit} style={S.form}>
            <Section title="자산 *">
              <select
                value={assetId}
                onChange={e => setAssetId(e.target.value)}
                style={S.input}
                disabled={loadingMaster}
                required
              >
                <option value="">{loadingMaster ? '불러오는 중…' : '— 자산 선택 —'}</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.machine_asset_number} — {a.name_en}
                  </option>
                ))}
              </select>
            </Section>

            <Section title="작업명 *">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 윤활유 교체, 벨트 점검"
                style={S.input}
                required
              />
            </Section>

            <Section title="작업 상세">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="작업 절차 및 주의사항"
                style={{ ...S.input, height: 100, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Section>

            <Section title="작업 유형">
              <select value={category} onChange={e => setCategory(e.target.value)} style={S.input}>
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Section>

            <Section title="체크리스트 항목 (선택)">
              <div style={{ background: '#0b1220', borderRadius: 8, padding: 10, border: '1px solid #334155', marginBottom: 8 }}>
                {checklistItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#64748b', padding: '4px 0' }}>항목 없음</div>
                ) : checklistItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#e2e8f0' }}>
                    <span>✓ {it}</span>
                    <button type="button" onClick={() => setChecklistItems(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', color: '#fca5a5', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={checklistInput} onChange={e => setChecklistInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (checklistInput.trim()) { setChecklistItems(prev => [...prev, checklistInput.trim()]); setChecklistInput(''); } } }}
                  placeholder="예: 오일 레벨 확인" style={{ ...S.input, flex: 1 }} />
                <button type="button" onClick={() => { if (checklistInput.trim()) { setChecklistItems(prev => [...prev, checklistInput.trim()]); setChecklistInput(''); } }}
                  style={{ padding: '0 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>추가</button>
              </div>
            </Section>

            <Section title="점검 주기 *">
              <div style={S.freqGrid}>
                {FREQ_OPTIONS.map(opt => {
                  const active = frequencyDays === opt.days;
                  return (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setFrequencyDays(opt.days)}
                      style={{
                        ...S.freqBtn,
                        borderColor: active ? '#2563eb' : '#334155',
                        background: active ? 'rgba(37,99,235,0.2)' : '#0b1220',
                        color: active ? '#93c5fd' : '#cbd5e1',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="시작일 *">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={S.input}
                required
              />
            </Section>

            <Section title="예상 작업시간 (시간)">
              <input
                type="number"
                step="0.5"
                min="0"
                value={estimatedHours}
                onChange={e => setEstimatedHours(e.target.value)}
                placeholder="예: 1.5"
                style={S.input}
              />
            </Section>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.actions}>
              <button
                type="button"
                onClick={() => router.push('/pm')}
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
  freqGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 },
  freqBtn: { padding: '14px 10px', borderRadius: 10, border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700, minHeight: 52, transition: 'all 0.15s' },
  actions: { display: 'flex', gap: 10, padding: '16px 16px 0' },
  btn: { flex: 1, padding: '16px', borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', minHeight: 52 },
  btnSecondary: { background: '#334155', color: '#e2e8f0' },
  btnPrimary: { background: '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed', boxShadow: 'none' },
  error: { margin: '0 16px 16px', padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
};
