import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';

// Buttons shown to operator (English + Tamil).
// Maps to bm_events.priority (exact) AND bm_events.severity (enum).
const SEVERITIES = [
  { v: 'low',      sev: 'minor',     en: 'Low',      ta: 'குறைவு',     hint_en: 'Minor issue', hint_ta: 'சிறிய பிரச்சனை' },
  { v: 'medium',   sev: 'normal',    en: 'Medium',   ta: 'நடுத்தரம்',   hint_en: 'Standard',    hint_ta: 'சாதாரண' },
  { v: 'high',     sev: 'major',     en: 'High',     ta: 'அதிகம்',      hint_en: 'Partial stop', hint_ta: 'பகுதி நிறுத்தம்' },
  { v: 'critical', sev: 'line_down', en: 'Critical', ta: 'மிக அவசரம்', hint_en: 'Line down',   hint_ta: 'வரிசை நின்றது' },
];

const SEV_COLORS = {
  low:      { border: '#475569', bg: '#1e293b', active: '#64748b' },
  medium:   { border: '#1e40af', bg: '#1e3a8a', active: '#2563eb' },
  high:     { border: '#a16207', bg: '#713f12', active: '#d97706' },
  critical: { border: '#b91c1c', bg: '#7f1d1d', active: '#dc2626' },
};

const PHOTO_BUCKET = 'bm-photos';

export default function NewBMPage() {
  const router = useRouter();
  const { user, isAuthed, fullName, loading: authLoading } = useAuth();
  const fileInputRef = useRef();

  const [assets, setAssets] = useState([]);
  const [causes, setCauses] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  const [assetId, setAssetId] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [symptom, setSymptom] = useState('');
  const [symptomTa, setSymptomTa] = useState('');
  const [downtimeStart, setDowntimeStart] = useState(() => toLocalInput(new Date()));
  const [causeCode, setCauseCode] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]); // File[]
  const [photoPreviews, setPhotoPreviews] = useState([]); // dataURL[]

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/bm/new')}`);
    }
  }, [authLoading, isAuthed, router]);

  // Pre-fill reporter name from auth metadata
  useEffect(() => {
    if (fullName && !reporterName) setReporterName(fullName);
  }, [fullName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load master data: assets + cause_codes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMaster(true);
      const [{ data: a, error: aErr }, { data: c, error: cErr }] = await Promise.all([
        supabase
          .from('assets')
          .select('id, machine_asset_number, name_en, name_ta, location, status')
          .order('machine_asset_number', { ascending: true }),
        supabase
          .from('cause_codes')
          .select('code, name_en, name_ta, group_name')
          .order('group_name', { ascending: true })
          .order('name_en', { ascending: true }),
      ]);
      if (cancelled) return;
      if (aErr) setError(`Asset load: ${aErr.message}`);
      if (cErr) setError(prev => prev || `Cause load: ${cErr.message}`);
      setAssets(a || []);
      setCauses(c || []);
      setLoadingMaster(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Pre-select asset from query (?asset=DCMI-XXXX)
  useEffect(() => {
    if (!router.query.asset || !assets.length) return;
    const tag = String(router.query.asset);
    const found = assets.find(x => x.machine_asset_number === tag);
    if (found) setAssetId(found.id);
  }, [router.query.asset, assets]);

  // Group causes by group_name for <optgroup>
  const causesByGroup = useMemo(() => {
    const m = new Map();
    for (const c of causes) {
      const g = c.group_name || 'Other';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(c);
    }
    return Array.from(m.entries());
  }, [causes]);

  function onPickFiles(e) {
    const files = Array.from(e.target.files || []).filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    setPhotoFiles(prev => [...prev, ...files]);
    files.forEach(f => {
      const fr = new FileReader();
      fr.onload = () => setPhotoPreviews(prev => [...prev, fr.result]);
      fr.readAsDataURL(f);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(idx) {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadPhotos(eventId) {
    if (!photoFiles.length) return [];
    const urls = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const f = photoFiles[i];
      setProgressMsg(`Uploading photo ${i + 1}/${photoFiles.length}…`);
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const safe = f.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60);
      const key = `${eventId}/${Date.now()}-${i}-${safe.endsWith(ext) ? safe : `${safe}.${ext}`}`;
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(key, f, { contentType: f.type, upsert: false });
      if (upErr) {
        // Bucket may not exist — skip silently per spec but log
        console.warn(`[bm-photos] upload failed: ${upErr.message}`);
        continue;
      }
      const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(key);
      if (pub?.publicUrl) urls.push(pub.publicUrl);
    }
    return urls;
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!assetId)        { setError('Select an equipment / உபகரணம் தேர்வு செய்க'); return; }
    if (!symptom.trim()) { setError('Describe the symptom / பிரச்சனையை விவரிக்கவும்'); return; }
    if (!reporterName.trim()) { setError('Enter your name / உங்கள் பெயரை உள்ளிடவும்'); return; }

    const sevDef = SEVERITIES.find(s => s.v === severity) || SEVERITIES[1];

    setBusy(true);
    setProgressMsg('Creating report…');
    try {
      // 1) Insert bm_event row first (without photos)
      const payload = {
        asset_id: assetId,
        reported_at: new Date().toISOString(),
        reporter_name: reporterName.trim(),
        reported_by: user?.id || null,
        severity: sevDef.sev,
        priority: sevDef.v,
        symptom: symptom.trim(),
        symptom_ta: symptomTa.trim() || null,
        downtime_start: downtimeStart ? new Date(downtimeStart).toISOString() : null,
        cause_code: causeCode || null,
        status: 'open',
        photos: [],
      };
      const { data: ev, error: insErr } = await supabase
        .from('bm_events')
        .insert(payload)
        .select('id')
        .single();
      if (insErr) throw insErr;

      // 2) Upload photos (best effort), then patch row
      const urls = await uploadPhotos(ev.id);
      if (urls.length) {
        setProgressMsg('Saving photo links…');
        const { error: updErr } = await supabase
          .from('bm_events')
          .update({ photos: urls })
          .eq('id', ev.id);
        if (updErr) console.warn(`[bm-photos] link save failed: ${updErr.message}`);
      }

      setProgressMsg('Done.');
      // 3) Redirect (or alert if /bm doesn't exist)
      try {
        await router.push('/bm');
      } catch {
        alert('Breakdown reported successfully.');
      }
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
      setProgressMsg('');
    }
  }

  const submitDisabled = busy || loadingMaster || !assetId || !symptom.trim() || !reporterName.trim();

  return (
    <>
      <Head>
        <title>Report Breakdown | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/bm" style={S.backLink}>← BM</Link>
          <div style={{ flex: 1 }}>
            <h1 style={S.title}>Report Breakdown</h1>
            <div style={S.titleTa}>முறிவு புகாரளி</div>
          </div>
        </header>

        {authLoading || !isAuthed ? (
          <div style={S.loading}>…</div>
        ) : (
          <form onSubmit={submit} style={S.form}>
            {/* ───────── Equipment ───────── */}
            <Section en="Equipment *" ta="உபகரணம் *">
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                style={S.input}
                disabled={loadingMaster}
                required
              >
                <option value="">
                  {loadingMaster ? 'Loading…' : '— Select equipment / தேர்வு செய்க —'}
                </option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.machine_asset_number} — {a.name_en}{a.location ? ` (${a.location})` : ''}
                  </option>
                ))}
              </select>
            </Section>

            {/* ───────── Severity / Priority ───────── */}
            <Section en="Severity *" ta="தீவிரம் *">
              <div style={S.sevGrid}>
                {SEVERITIES.map(s => {
                  const active = severity === s.v;
                  const c = SEV_COLORS[s.v];
                  return (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setSeverity(s.v)}
                      style={{
                        ...S.sevBtn,
                        borderColor: active ? c.active : c.border,
                        background: active ? c.active : c.bg,
                        color: '#fff',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{s.en}</div>
                      <div style={{ fontSize: 13, opacity: 0.95 }}>{s.ta}</div>
                      <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4 }}>
                        {s.hint_en} · {s.hint_ta}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* ───────── Symptom EN ───────── */}
            <Section en="Symptom (English) *" ta="அறிகுறி (ஆங்கிலம்) *">
              <textarea
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                placeholder="What is wrong? Sound / smell / error code?"
                style={{ ...S.input, height: 110, fontFamily: 'inherit', resize: 'vertical' }}
                required
              />
            </Section>

            {/* ───────── Symptom TA ───────── */}
            <Section en="Symptom (Tamil)" ta="அறிகுறி (தமிழ்)">
              <textarea
                value={symptomTa}
                onChange={(e) => setSymptomTa(e.target.value)}
                placeholder="என்ன பிரச்சனை? சத்தம் / வாசனை / பிழை குறியீடு?"
                style={{ ...S.input, height: 90, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Section>

            {/* ───────── Downtime start ───────── */}
            <Section en="Downtime Start" ta="நிறுத்தம் தொடங்கியது">
              <input
                type="datetime-local"
                value={downtimeStart}
                onChange={(e) => setDowntimeStart(e.target.value)}
                style={S.input}
              />
            </Section>

            {/* ───────── Cause code ───────── */}
            <Section en="Cause" ta="காரணம்">
              <select
                value={causeCode}
                onChange={(e) => setCauseCode(e.target.value)}
                style={S.input}
                disabled={loadingMaster}
              >
                <option value="">— Unknown / தெரியவில்லை —</option>
                {causesByGroup.map(([group, list]) => (
                  <optgroup key={group} label={group}>
                    {list.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name_en}{c.name_ta ? ` / ${c.name_ta}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Section>

            {/* ───────── Reporter ───────── */}
            <Section en="Reporter Name *" ta="புகாரளிப்பவர் பெயர் *">
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Your name / உங்கள் பெயர்"
                style={S.input}
                required
              />
            </Section>

            {/* ───────── Photos ───────── */}
            <Section en="Photos" ta="புகைப்படங்கள்">
              {photoPreviews.length > 0 && (
                <div style={S.photoGrid}>
                  {photoPreviews.map((src, i) => (
                    <div key={i} style={S.photoTile}>
                      <img src={src} alt={`photo ${i + 1}`} style={S.photoImg} />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        style={S.photoDel}
                        aria-label="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                multiple
                onChange={onPickFiles}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={S.photoAdd}
              >
                {photoPreviews.length === 0
                  ? 'Add photo / புகைப்படம் சேர்'
                  : '+ Add another / மேலும் சேர்'}
              </button>
            </Section>

            {error && <div style={S.error}>{error}</div>}
            {busy && progressMsg && <div style={S.progress}>{progressMsg}</div>}

            <div style={S.actions}>
              <button
                type="button"
                onClick={() => router.push('/bm')}
                style={{ ...S.btn, ...S.btnSecondary }}
                disabled={busy}
              >
                Cancel / ரத்து
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                style={{
                  ...S.btn,
                  ...S.btnDanger,
                  ...(submitDisabled ? S.btnDisabled : null),
                }}
              >
                {busy ? 'Submitting…' : 'Report / புகாரளி'}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}

function Section({ en, ta, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>
        <span>{en}</span>
        {ta && <span style={S.sectionTitleTa}>{ta}</span>}
      </div>
      <div style={S.sectionBody}>{children}</div>
    </section>
  );
}

// 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", sans-serif',
    background: '#0b1220', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 80,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#7f1d1d', color: '#fff', padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
  },
  backLink: {
    color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: 14,
    padding: '8px 4px',
  },
  title: { fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.1 },
  titleTa: { fontSize: 12, opacity: 0.85, marginTop: 2 },
  loading: { padding: 32, textAlign: 'center', color: '#94a3b8' },
  form: { padding: 12 },
  section: {
    background: '#111827', borderRadius: 12, marginBottom: 10,
    border: '1px solid #1f2937', overflow: 'hidden',
  },
  sectionTitle: {
    padding: '10px 14px', fontSize: 12, fontWeight: 700,
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
    display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline',
  },
  sectionTitleTa: {
    fontSize: 11, color: '#cbd5e1', textTransform: 'none', letterSpacing: 0,
    fontWeight: 500,
  },
  sectionBody: { padding: 12 },
  input: {
    width: '100%', padding: '12px 12px',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    background: '#0b1220', color: '#f1f5f9',
    minHeight: 44,
  },
  sevGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  sevBtn: {
    padding: '12px 10px', borderRadius: 10, border: '2px solid',
    textAlign: 'left', cursor: 'pointer',
    minHeight: 72,
  },
  photoGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10,
  },
  photoTile: { position: 'relative' },
  photoImg: {
    width: '100%', aspectRatio: '1', objectFit: 'cover',
    borderRadius: 8, display: 'block', background: '#0f172a',
  },
  photoDel: {
    position: 'absolute', top: 4, right: 4,
    background: 'rgba(0,0,0,0.7)', color: '#fff',
    width: 26, height: 26, borderRadius: '50%', border: 'none',
    fontSize: 18, lineHeight: '22px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: '100%', padding: '14px', borderRadius: 10,
    border: '2px dashed #334155', background: '#0b1220', color: '#cbd5e1',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 48,
  },
  error: {
    background: '#7f1d1d', color: '#fee2e2',
    padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 10,
    border: '1px solid #b91c1c',
  },
  progress: {
    background: '#1e3a8a', color: '#dbeafe',
    padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10,
    border: '1px solid #2563eb',
  },
  actions: { display: 'flex', gap: 10, marginTop: 8 },
  btn: {
    flex: 1, padding: '14px 18px', borderRadius: 10, border: 'none',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 48,
  },
  btnDanger: { background: '#dc2626', color: '#fff' },
  btnSecondary: { background: '#334155', color: '#e2e8f0' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed' },
};
