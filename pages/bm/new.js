import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';

const SEVERITIES = [
  { v: 'minor',     label: 'Minor',     desc: 'Small issue, production continues' },
  { v: 'normal',    label: 'Normal',    desc: 'Standard breakdown' },
  { v: 'major',     label: 'Major',     desc: 'Significant issue, partial stop' },
  { v: 'line_down', label: 'Line Down', desc: 'Production stopped' },
];

export default function NewBMPage() {
  const router = useRouter();
  const { user, isAuthed, employeeId, fullName, loading: authLoading } = useAuth();

  const [assetSearch, setAssetSearch] = useState('');
  const [assetOptions, setAssetOptions] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const [severity, setSeverity] = useState('normal');
  const [symptom, setSymptom] = useState('');
  const [downtime, setDowntime] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/bm/new')}`);
    }
  }, [authLoading, isAuthed, router]);

  // Preload asset if ?asset=DCMI-...
  useEffect(() => {
    if (!router.query.asset) return;
    const tag = String(router.query.asset);
    supabase.from('assets').select('id, machine_asset_number, name_en, location').eq('machine_asset_number', tag).maybeSingle()
      .then(({ data }) => data && setSelectedAsset(data));
  }, [router.query.asset]);

  // Search assets as user types
  useEffect(() => {
    if (!assetSearch || selectedAsset) { setAssetOptions([]); return; }
    const q = assetSearch.trim();
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('assets')
        .select('id, machine_asset_number, name_en, location')
        .or(`machine_asset_number.ilike.%${q}%,name_en.ilike.%${q}%`)
        .limit(8);
      setAssetOptions(data || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [assetSearch, selectedAsset]);

  async function submit(e) {
    e.preventDefault();
    if (!selectedAsset) { setError('Select an asset first'); return; }
    if (!symptom.trim()) { setError('Describe the symptom'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        asset_id: selectedAsset.id,
        reported_by: user?.id,
        reporter_name: fullName || user?.email,
        severity,
        symptom: symptom.trim(),
        downtime_minutes: downtime ? parseInt(downtime, 10) : null,
        status: 'open',
      };
      const { data, error } = await supabase.from('bm_events').insert(payload).select().single();
      if (error) throw error;
      router.push(`/bm/${data.id}`);
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Report BM | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/bm" style={S.backLink}>← BM</Link>
          <h1 style={S.title}>Report Breakdown</h1>
        </header>

        {authLoading || !isAuthed ? (
          <div style={S.loading}>…</div>
        ) : (
          <form onSubmit={submit} style={S.form}>
            <Section title="Asset">
              {selectedAsset ? (
                <div style={S.selectedAsset}>
                  <div>
                    <strong>{selectedAsset.machine_asset_number}</strong>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{selectedAsset.name_en}</div>
                    {selectedAsset.location && <div style={{ fontSize: 12, color: '#94a3b8' }}>{selectedAsset.location}</div>}
                  </div>
                  <button type="button" onClick={() => { setSelectedAsset(null); setAssetSearch(''); }} style={S.changeBtn}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Type asset number or name…"
                    style={S.input}
                    autoFocus
                  />
                  {assetOptions.length > 0 && (
                    <div style={S.options}>
                      {assetOptions.map(a => (
                        <button key={a.id} type="button" onClick={() => setSelectedAsset(a)} style={S.option}>
                          <strong>{a.machine_asset_number}</strong>
                          <span style={{ marginLeft: 8, color: '#64748b' }}>{a.name_en}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Section>

            <Section title="Severity">
              <div style={S.sevGrid}>
                {SEVERITIES.map(s => (
                  <button key={s.v} type="button" onClick={() => setSeverity(s.v)} style={{
                    ...S.sevBtn,
                    ...(severity === s.v ? S.sevBtnActive : null),
                    ...(s.v === 'line_down' && severity === s.v ? S.sevBtnDanger : null),
                  }}>
                    <div style={{ fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Symptom *">
              <textarea
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                placeholder="What's wrong? When did it start? Any sound/smell/error code?"
                style={{ ...S.input, height: 120, fontFamily: 'inherit', resize: 'vertical' }}
                required
              />
            </Section>

            <Section title="Downtime (minutes)">
              <input
                value={downtime}
                onChange={(e) => setDowntime(e.target.value)}
                type="number"
                min="0"
                max="9999"
                placeholder="0"
                style={S.input}
                inputMode="numeric"
              />
            </Section>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.actions}>
              <button type="button" onClick={() => router.push('/bm')} style={{ ...S.btn, ...S.btnSecondary }}>
                Cancel
              </button>
              <button type="submit" disabled={busy || !selectedAsset || !symptom.trim()} style={{
                ...S.btn, ...S.btnDanger,
                ...((busy || !selectedAsset || !symptom.trim()) ? S.btnDisabled : null),
              }}>
                {busy ? 'Reporting…' : '🚨 Report'}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={S.sectionBody}>{children}</div>
    </section>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    background: '#f8fafc', minHeight: '100vh', color: '#0f172a', paddingBottom: 60,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#dc2626', color: '#fff', padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  backLink: { color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 14 },
  title: { fontSize: 18, fontWeight: 600, flex: 1, margin: 0 },
  loading: { padding: 32, textAlign: 'center', color: '#64748b' },
  form: { padding: 16 },
  section: {
    background: '#fff', borderRadius: 12, marginBottom: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  sectionTitle: {
    padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5,
    background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
  },
  sectionBody: { padding: 14 },
  input: {
    width: '100%', padding: '11px 12px',
    border: '1px solid #cbd5e1', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#f8fafc',
  },
  options: { marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' },
  option: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '10px 12px', background: '#fff', border: 'none',
    borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13,
  },
  selectedAsset: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, background: '#f8fafc', borderRadius: 8,
  },
  changeBtn: {
    padding: '6px 12px', background: '#e2e8f0', color: '#0f172a',
    border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
  sevGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  sevBtn: {
    padding: '12px', borderRadius: 8, border: '2px solid #e2e8f0',
    background: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 13,
    color: '#475569',
  },
  sevBtnActive: { borderColor: '#0f172a', background: '#0f172a', color: '#fff' },
  sevBtnDanger: { borderColor: '#dc2626', background: '#dc2626', color: '#fff' },
  error: {
    background: '#fee2e2', color: '#991b1b',
    padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 12,
  },
  actions: { display: 'flex', gap: 10 },
  btn: {
    flex: 1, padding: '14px 20px', borderRadius: 10, border: 'none',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  btnDanger: { background: '#dc2626', color: '#fff' },
  btnSecondary: { background: '#e2e8f0', color: '#0f172a' },
  btnDisabled: { background: '#cbd5e1', color: '#64748b', cursor: 'not-allowed' },
};
