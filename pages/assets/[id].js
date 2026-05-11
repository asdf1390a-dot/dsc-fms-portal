import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import PhotoUploader from '../../components/PhotoUploader';

const STATUS_STYLES = {
  active:      { bg: '#dcfce7', fg: '#166534', label: 'ACTIVE' },
  idle:        { bg: '#fef3c7', fg: '#92400e', label: 'IDLE' },
  maintenance: { bg: '#dbeafe', fg: '#1e40af', label: 'MAINT' },
  sold:        { bg: '#e5e7eb', fg: '#374151', label: 'SOLD' },
  scrapped:    { bg: '#fee2e2', fg: '#991b1b', label: 'SCRAP' },
};

export default function AssetDetail() {
  const router = useRouter();
  const { id } = router.query; // machine_asset_number
  const { isAuthed, employeeId, fullName } = useAuth();
  const [asset, setAsset] = useState(null);
  const [klass, setKlass] = useState(null);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bmEvents, setBmEvents] = useState([]);

  const baseUrl = 'https://dsc-fms-portal.vercel.app';
  const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(`${baseUrl}/bm/new?asset=${asset?.machine_asset_number}`)}&choe=UTF-8`;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('assets')
        .select('*')
        .eq('machine_asset_number', id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data) { setError('Not found'); setLoading(false); return; }
      setAsset(data);
      const { data: cl } = await supabase.from('asset_classes')
        .select('*')
        .eq('code', data.asset_class_code)
        .maybeSingle();
      setKlass(cl);
      if (cl) {
        const { data: cat } = await supabase.from('categories')
          .select('*')
          .eq('code', cl.category_code)
          .maybeSingle();
        setCategory(cat);
      }
      // BM history for this asset (silently swallow if bm_events not yet created)
      supabase.from('bm_events')
        .select('id, severity, symptom, status, reported_at, resolved_at')
        .eq('asset_id', data.id)
        .order('reported_at', { ascending: false })
        .limit(10)
        .then(({ data: bm }) => { if (!cancelled) setBmEvents(bm || []); });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <>
      <Head>
        <title>{asset ? `${asset.machine_asset_number} | DSC FMS` : 'Asset | DSC FMS'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/assets" style={S.backLink}>← Assets</Link>
          <h1 style={S.title}>Asset</h1>
          {isAuthed ? (
            <span style={S.userChip} title={fullName || 'logged in'}>
              {employeeId || fullName?.split(' ')[0] || '✓'}
            </span>
          ) : (
            <Link href="/login" style={S.loginLink}>Sign in</Link>
          )}
        </header>

        {loading && <div style={S.loading}>Loading…</div>}
        {error && <div style={S.errorBox}>{error}</div>}

        {asset && (
          <div style={S.content}>
            <div style={S.tagCard}>
              <div style={S.tagBig}>{asset.machine_asset_number}</div>
              <div style={S.tagMeta}>
                <span>{asset.machine_asset_code}</span>
                <StatusBadge status={asset.status} />
              </div>
            </div>

            <Section title="Name">
              <div style={S.name}>{asset.name_en}</div>
              {asset.name_ta && <div style={S.nameSub}>{asset.name_ta}</div>}
            </Section>

            {(asset.photos?.length > 0 || isAuthed) && (
              <Section title={`Photos${asset.photos?.length ? ` (${asset.photos.length})` : ''}`}>
                {isAuthed ? (
                  <PhotoUploader
                    asset={asset}
                    onPhotosChange={(newPhotos) => setAsset(a => ({ ...a, photos: newPhotos }))}
                  />
                ) : (
                  <div style={S.photoGrid}>
                    {(asset.photos || []).map((p, i) => (
                      <a key={i} href={p} target="_blank" rel="noopener">
                        <img src={p} alt={`photo ${i + 1}`} style={S.photo} />
                      </a>
                    ))}
                  </div>
                )}
              </Section>
            )}

            <Section title="Category">
              <Field label="Code" value={asset.asset_class_code} />
              {klass && <Field label="Class" value={klass.name_en} />}
              {category && <Field label="Major" value={`${category.code} · ${category.name_en}`} />}
            </Section>

            <Section title="Specs">
              <Field label="Model" value={asset.model} />
              <Field label="Make" value={asset.make} />
              <Field label="Serial" value={asset.serial_no} />
              <Field label="Year" value={asset.year_of_manufacture} />
            </Section>

            <Section title="Location">
              <Field label="Location" value={asset.location} />
            </Section>

            {asset.extra && Object.keys(asset.extra).length > 0 && (
              <Section title="Additional">
                {Object.entries(asset.extra).map(([k, v]) => (
                  <Field key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                ))}
              </Section>
            )}

            {asset.remark && (
              <Section title="Remark">
                <div style={S.remark}>{asset.remark}</div>
              </Section>
            )}

            <Section title="Meta">
              <Field label="Created" value={asset.created_at ? new Date(asset.created_at).toLocaleString() : null} />
              <Field label="Updated" value={asset.updated_at ? new Date(asset.updated_at).toLocaleString() : null} />
              <Field label="QR" value={asset.qr_payload} />
            </Section>

            <Section title={`Breakdown History${bmEvents.length ? ` (${bmEvents.length})` : ''}`}>
              {isAuthed && (
                <Link
                  href={`/bm/new?asset=${encodeURIComponent(asset.machine_asset_number)}`}
                  style={S.bmReportBtn}
                >
                  🚨 Report Breakdown
                </Link>
              )}
              {bmEvents.length > 0 ? (
                <ul style={S.bmList}>
                  {bmEvents.map(e => (
                    <li key={e.id}>
                      <Link href={`/bm/${e.id}`} style={S.bmItem}>
                        <span style={{
                          ...S.bmStatus,
                          background: ['open', 'in_progress', 'pending_parts'].includes(e.status) ? '#fee2e2' : '#dcfce7',
                          color: ['open', 'in_progress', 'pending_parts'].includes(e.status) ? '#991b1b' : '#166534',
                        }}>
                          {e.status === 'in_progress' ? 'WIP' : e.status.toUpperCase().slice(0, 6)}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#334155' }}>{e.symptom.slice(0, 60)}{e.symptom.length > 60 ? '…' : ''}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {new Date(e.reported_at).toLocaleDateString()} · {e.severity}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : !isAuthed ? (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>(none)</div>
              ) : null}
            </Section>

            <section style={{ margin: '16px 0 0', background: '#1e293b', borderRadius: 12, padding: 16, border: '1px solid #334155' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>QR 코드</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: 8 }}>
                  <img src={qrUrl} alt="QR코드" width={160} height={160} style={{ display: 'block' }} />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                  이 QR을 스캔하면 BM 신고 폼으로 이동합니다
                </div>
              </div>
            </section>

            <div style={S.actions}>
              {isAuthed ? (
                <Link href={`/assets/edit/${encodeURIComponent(asset.machine_asset_number)}`}
                  style={{ ...S.btn, ...S.btnPrimary, textDecoration: 'none', textAlign: 'center' }}>
                  ✎ Edit
                </Link>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(`/assets/edit/${asset.machine_asset_number}`)}`}
                  style={{ ...S.btn, ...S.btnPrimary, textDecoration: 'none', textAlign: 'center' }}>
                  Sign in to edit
                </Link>
              )}
            </div>
          </div>
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

function Field({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      <span style={S.fieldValue}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span style={{
      backgroundColor: s.bg, color: s.fg,
      padding: '4px 10px', borderRadius: 8,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>{s.label}</span>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", sans-serif',
    background: '#f8fafc', minHeight: '100vh', color: '#0f172a', paddingBottom: 80,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#0f172a', color: '#fff', padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  title: { fontSize: 18, fontWeight: 600, flex: 1, margin: 0 },
  loading: { padding: 32, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 16, padding: 14, background: '#fee2e2', color: '#991b1b', borderRadius: 10 },
  content: { padding: 16 },

  tagCard: {
    background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  tagBig: { fontSize: 22, fontWeight: 700, color: '#0f172a', wordBreak: 'break-all' },
  tagMeta: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 12, color: '#64748b' },

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

  name: { fontSize: 17, fontWeight: 500 },
  nameSub: { fontSize: 13, color: '#64748b', marginTop: 4 },

  field: { display: 'flex', gap: 12, padding: '6px 0', fontSize: 14 },
  fieldLabel: { color: '#94a3b8', minWidth: 90, fontSize: 13 },
  fieldValue: { color: '#0f172a', flex: 1, wordBreak: 'break-word', textTransform: 'capitalize' },

  remark: { fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap' },

  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  photo: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 },

  actions: { display: 'flex', gap: 8, marginTop: 16 },
  btn: {
    padding: '12px 20px', borderRadius: 10, border: 'none',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', flex: 1,
    display: 'inline-block',
  },
  btnPrimary: { background: '#0f172a', color: '#fff' },
  btnDisabled: { background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' },

  userChip: {
    background: '#22c55e', color: '#fff', borderRadius: 999,
    padding: '4px 10px', fontSize: 12, fontWeight: 600,
  },
  loginLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 13,
    padding: '6px 10px', border: '1px solid #334155', borderRadius: 6,
  },

  bmReportBtn: {
    display: 'block', background: '#dc2626', color: '#fff',
    padding: '12px', borderRadius: 10, textDecoration: 'none',
    textAlign: 'center', fontSize: 14, fontWeight: 700,
    marginBottom: 12,
  },
  bmList: { listStyle: 'none', margin: 0, padding: 0 },
  bmItem: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: '10px 0', textDecoration: 'none', color: 'inherit',
    borderTop: '1px solid #f1f5f9',
  },
  bmStatus: {
    fontSize: 10, fontWeight: 700,
    padding: '3px 7px', borderRadius: 4,
    minWidth: 48, textAlign: 'center', letterSpacing: 0.3,
  },
};
