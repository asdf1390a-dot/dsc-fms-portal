import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Status flow & labels ────────────────────────────────────────────
const STATUS_FLOW = {
  open:          ['in_progress', 'pending_parts', 'resolved', 'wontfix', 'cancelled'],
  in_progress:   ['pending_parts', 'resolved', 'open'],
  pending_parts: ['in_progress', 'resolved'],
  resolved:      ['in_progress'],
  wontfix:       ['open'],
  cancelled:     ['open'],
};
const STATUS_LABEL = {
  open: '접수', in_progress: '진행중', pending_parts: '부품대기',
  resolved: '완료', wontfix: '미처리', cancelled: '취소',
};
const STATUS_PILL = {
  open:          { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)' },
  in_progress:   { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)' },
  pending_parts: { bg: 'rgba(234,179,8,0.18)',  fg: '#fde68a', border: 'rgba(234,179,8,0.6)' },
  resolved:      { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)' },
  wontfix:       { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)' },
  cancelled:     { bg: 'rgba(71,85,105,0.25)',  fg: '#94a3b8', border: 'rgba(71,85,105,0.6)' },
};

// ── Severity → priority bar colour ─────────────────────────────────
const SEVERITY_LABEL = {
  line_down: '라인다운', major: '주요', normal: '정상', minor: '경미',
};
const SEVERITY_BAR = {
  line_down: '#dc2626', major: '#f97316', normal: '#2563eb', minor: '#64748b',
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BMDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthed, fullName } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [action, setAction] = useState('');
  const [cause, setCause] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('bm_events')
        .select('*, assets(machine_asset_number, name_en, location)')
        .eq('id', id).maybeSingle();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data) { setError('찾을 수 없습니다'); setLoading(false); return; }
      setEvent(data);
      setAction(data.action_taken || '');
      setCause(data.cause || '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function changeStatus(newStatus) {
    if (!event) return;
    setBusy(true);
    setError(null);
    try {
      const patch = { status: newStatus };
      if (newStatus === 'resolved') {
        const nowIso = new Date().toISOString();
        patch.resolved_at = nowIso;
        patch.downtime_end = nowIso;
        patch.resolved_by = user?.id;
        patch.resolver_name = fullName || user?.email;
      }
      const { data, error } = await supabase.from('bm_events')
        .update(patch).eq('id', event.id).select().single();
      if (error) throw error;
      setEvent(prev => ({ ...prev, ...data, assets: prev.assets }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (!event) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.from('bm_events').update({
        action_taken: action, cause,
      }).eq('id', event.id);
      if (error) throw error;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveNow() {
    // One-tap "수리 완료 처리" — saves notes then flips status to resolved.
    if (!event) return;
    setBusy(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const patch = {
        action_taken: action,
        cause,
        status: 'resolved',
        resolved_at: nowIso,
        downtime_end: nowIso,
        resolved_by: user?.id || null,
        resolver_name: fullName || user?.email || null,
      };
      const { data, error } = await supabase.from('bm_events')
        .update(patch).eq('id', event.id).select().single();
      if (error) throw error;
      setEvent(prev => ({ ...prev, ...data, assets: prev.assets }));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const st = event ? STATUS_PILL[event.status] : null;
  const nextStatuses = event ? (STATUS_FLOW[event.status] || []) : [];
  const photos = Array.isArray(event?.photos) ? event.photos : [];
  const barColor = event ? (SEVERITY_BAR[event.severity] || SEVERITY_BAR.normal) : null;

  return (
    <>
      <Head>
        <title>{event ? `BM #${String(event.id).slice(0, 6)}` : 'BM'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        {/* ── Sticky header ───────────────────────────────────────── */}
        <header style={S.header}>
          <Link href="/bm" style={S.backLink} aria-label="목록으로">← BM 이력</Link>
          <div style={S.headerTitleWrap}>
            <div style={S.headerTitle}>
              {event?.assets?.machine_asset_number || 'BM Event'}
            </div>
            {event?.assets?.name_en && (
              <div style={S.headerSubtitle}>{event.assets.name_en}</div>
            )}
          </div>
          {isAuthed && event ? (
            <Link href={`/bm/edit/${event.id}`} style={S.editLink} aria-label="편집">
              편집
            </Link>
          ) : (
            <div style={{ width: 44 }} />
          )}
        </header>

        {loading && <div style={S.loading}>불러오는 중…</div>}

        {error && (
          <div style={S.errorBox}>{error}</div>
        )}

        {event && (
          <div style={S.content}>
            {/* ── Status / severity hero card ────────────────────── */}
            <div style={S.heroCard}>
              <span style={{ ...S.heroBar, background: barColor }} aria-hidden="true" />
              <div style={S.heroBody}>
                <div style={S.heroPillRow}>
                  <span style={{
                    ...S.statusPill,
                    background: st?.bg, color: st?.fg, borderColor: st?.border,
                  }}>
                    {STATUS_LABEL[event.status] || event.status}
                  </span>
                  <span style={S.severityPill}>
                    {SEVERITY_LABEL[event.severity] || event.severity?.toUpperCase()}
                  </span>
                </div>
                <div style={S.heroId}>BM #{String(event.id).slice(0, 8)}</div>
              </div>
            </div>

            {/* ── Asset link ─────────────────────────────────────── */}
            <Section title="자산">
              <Link
                href={`/assets/${encodeURIComponent(event.assets?.machine_asset_number || '')}`}
                style={S.assetLink}
              >
                <div style={S.assetTag}>{event.assets?.machine_asset_number}</div>
                {event.assets?.name_en && (
                  <div style={S.assetName}>{event.assets.name_en}</div>
                )}
                {event.assets?.location && (
                  <div style={S.assetLoc}>📍 {event.assets.location}</div>
                )}
                <div style={S.assetArrow}>→</div>
              </Link>
            </Section>

            {/* ── Symptom ────────────────────────────────────────── */}
            <Section title="증상">
              <div style={S.text}>{event.symptom}</div>
              {event.symptom_ta && (
                <div style={{ ...S.text, marginTop: 8, color: '#94a3b8', fontStyle: 'italic' }}>
                  {event.symptom_ta}
                </div>
              )}
            </Section>

            {/* ── Photos ─────────────────────────────────────────── */}
            {photos.length > 0 && (
              <Section title={`사진 · ${photos.length}`}>
                <div style={S.photoGrid}>
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIdx(i)}
                      style={S.photoTile}
                      aria-label={`사진 ${i + 1} 열기`}
                    >
                      <img src={url} alt={`BM photo ${i + 1}`} style={S.photoImg} loading="lazy" />
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Action taken ───────────────────────────────────── */}
            <Section title="조치 내용">
              {isAuthed ? (
                <textarea
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="무엇을 했나요?"
                  style={{ ...S.input, height: 100 }}
                />
              ) : (
                <div style={S.text}>
                  {event.action_taken || <em style={{ color: '#64748b' }}>(미입력)</em>}
                </div>
              )}
            </Section>

            {/* ── Root cause ─────────────────────────────────────── */}
            <Section title="원인">
              {isAuthed ? (
                <textarea
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  placeholder="왜 발생했나요?"
                  style={{ ...S.input, height: 80 }}
                />
              ) : (
                <div style={S.text}>
                  {event.cause || <em style={{ color: '#64748b' }}>(미입력)</em>}
                </div>
              )}
            </Section>

            {/* ── Save / Resolve actions ────────────────────────── */}
            {isAuthed && (
              <div style={S.primaryActions}>
                <button
                  type="button"
                  onClick={saveNotes}
                  disabled={busy}
                  style={{
                    ...S.btn, ...S.btnSecondary,
                    ...(busy ? S.btnDisabled : null),
                  }}
                >
                  {busy ? '저장 중…' : '메모 저장'}
                </button>
                {event.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={resolveNow}
                    disabled={busy}
                    style={{
                      ...S.btn, ...S.btnResolve,
                      ...(busy ? S.btnDisabled : null),
                    }}
                  >
                    ✓ 수리 완료 처리
                  </button>
                )}
              </div>
            )}
            {savedFlash && (
              <div style={S.savedFlash}>✓ 저장되었습니다</div>
            )}

            {/* ── Timeline ───────────────────────────────────────── */}
            <Section title="이력">
              <Row
                label="신고일"
                value={`${formatDateTime(event.reported_at)}${event.reporter_name ? ` · ${event.reporter_name}` : ''}`}
              />
              {event.downtime_start && (
                <Row
                  label="작동 중단"
                  value={formatDateTime(event.downtime_start)}
                />
              )}
              {event.resolved_at && (
                <Row
                  label="완료일"
                  value={`${formatDateTime(event.resolved_at)}${event.resolver_name ? ` · ${event.resolver_name}` : ''}`}
                />
              )}
              {event.downtime_minutes != null && (
                <Row label="중단 시간" value={`${event.downtime_minutes} 분`} />
              )}
              {event.cause_code && (
                <Row label="원인 코드" value={event.cause_code} />
              )}
            </Section>

            {/* ── Change status — secondary controls ─────────────── */}
            {isAuthed && nextStatuses.length > 0 && (
              <Section title="상태 변경">
                <div style={S.statusGrid}>
                  {nextStatuses.map(s => {
                    const isResolve = s === 'resolved';
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => changeStatus(s)}
                        disabled={busy}
                        style={{
                          ...S.statusBtn,
                          ...(isResolve ? S.statusBtnResolve : null),
                          ...(busy ? S.btnDisabled : null),
                        }}
                      >
                        → {STATUS_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── Lightbox ───────────────────────────────────────────── */}
        {lightboxIdx != null && photos[lightboxIdx] && (
          <div
            style={S.lightbox}
            onClick={() => setLightboxIdx(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
              style={S.lightboxClose}
              aria-label="닫기"
            >×</button>
            <img
              src={photos[lightboxIdx]}
              alt={`Photo ${lightboxIdx + 1}`}
              style={S.lightboxImg}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={S.lightboxCount}>
              {lightboxIdx + 1} / {photos.length}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={S.sectionBody}>{children}</div>
    </section>
  );
}

// ── Row inside a section (label/value) ──────────────────────────────
function Row({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowValue}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────
const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto',
  },

  // Header
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f172a',
    borderBottom: '1px solid #1f2937',
    padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  backLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 14,
    minHeight: 44, minWidth: 44,
    display: 'inline-flex', alignItems: 'center',
    padding: '0 4px',
  },
  editLink: {
    color: '#93c5fd', textDecoration: 'none', fontSize: 14,
    minHeight: 44, minWidth: 44, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
    padding: '0 4px',
  },
  headerTitleWrap: { flex: 1, minWidth: 0, textAlign: 'center' },
  headerTitle: {
    fontSize: 15, fontWeight: 700, color: '#f8fafc',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  headerSubtitle: {
    fontSize: 11, color: '#94a3b8', marginTop: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: {
    margin: 14, padding: 14,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 10, fontSize: 14,
  },

  content: { padding: 14 },

  // Hero card
  heroCard: {
    position: 'relative', display: 'flex',
    background: '#1e293b', borderRadius: 12, marginBottom: 12,
    overflow: 'hidden', border: '1px solid #1f2937',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  heroBar: { width: 4, flexShrink: 0 },
  heroBody: { flex: 1, padding: '14px 14px 14px 14px' },
  heroPillRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  statusPill: {
    padding: '5px 12px', borderRadius: 999,
    fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
    border: '1px solid',
  },
  severityPill: {
    padding: '5px 12px', borderRadius: 999,
    fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
    border: '1px solid #334155',
    background: '#0f172a', color: '#cbd5e1',
  },
  heroId: {
    fontSize: 11, color: '#64748b',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },

  // Section
  section: {
    background: '#1e293b', borderRadius: 12, marginBottom: 10,
    border: '1px solid #1f2937', overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  sectionTitle: {
    padding: '10px 14px', fontSize: 11, fontWeight: 700,
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
  },
  sectionBody: { padding: 14 },

  // Asset link
  assetLink: {
    position: 'relative',
    display: 'block', textDecoration: 'none', color: '#e2e8f0',
    padding: '4px 28px 4px 0', minHeight: 44,
  },
  assetTag: {
    fontSize: 15, fontWeight: 700, color: '#f8fafc',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  assetName: { fontSize: 13, color: '#cbd5e1', marginTop: 3 },
  assetLoc: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  assetArrow: {
    position: 'absolute', right: 0, top: '50%',
    transform: 'translateY(-50%)',
    color: '#64748b', fontSize: 20,
  },

  // Body text & inputs
  text: {
    fontSize: 14, color: '#e2e8f0', lineHeight: 1.5,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  input: {
    width: '100%', padding: '12px',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    background: '#0b1220', color: '#f1f5f9',
    fontFamily: 'inherit', resize: 'vertical',
    minHeight: 44,
  },

  // Photo grid + lightbox
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  photoTile: {
    position: 'relative', padding: 0, border: 'none',
    background: '#0f172a', borderRadius: 8, overflow: 'hidden',
    cursor: 'pointer', aspectRatio: '1',
  },
  photoImg: {
    width: '100%', height: '100%', objectFit: 'cover',
    display: 'block',
  },
  lightbox: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  lightboxImg: {
    maxWidth: '100%', maxHeight: '85vh',
    objectFit: 'contain', borderRadius: 4,
  },
  lightboxClose: {
    position: 'absolute', top: 'calc(env(safe-area-inset-top, 0) + 12px)', right: 16,
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)', color: '#fff',
    border: 'none', cursor: 'pointer',
    fontSize: 24, lineHeight: '24px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  lightboxCount: {
    position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0) + 16px)', left: 0, right: 0,
    textAlign: 'center', color: '#cbd5e1', fontSize: 13,
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },

  // Primary actions
  primaryActions: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
    margin: '4px 0 12px',
  },
  btn: {
    padding: '14px', borderRadius: 10, border: 'none',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    minHeight: 48,
  },
  btnSecondary: {
    background: '#334155', color: '#e2e8f0',
    border: '1px solid #475569',
  },
  btnResolve: {
    background: '#16a34a', color: '#fff',
    boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
    fontSize: 15,
  },
  btnDisabled: {
    background: '#1f2937', color: '#475569',
    cursor: 'not-allowed', boxShadow: 'none',
  },
  savedFlash: {
    background: 'rgba(34,197,94,0.18)',
    color: '#86efac',
    border: '1px solid rgba(34,197,94,0.5)',
    padding: '10px 14px', borderRadius: 8, marginBottom: 12,
    fontSize: 13, textAlign: 'center', fontWeight: 600,
  },

  // Row label/value
  row: {
    display: 'flex', gap: 12,
    padding: '6px 0', fontSize: 13,
    borderBottom: '1px solid rgba(31,41,55,0.5)',
  },
  rowLabel: { color: '#64748b', minWidth: 110, flexShrink: 0 },
  rowValue: { color: '#e2e8f0', flex: 1, wordBreak: 'break-word' },

  // Status workflow buttons
  statusGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  statusBtn: {
    padding: '12px 10px', minHeight: 48,
    border: '1px solid #334155',
    background: '#0f172a', color: '#cbd5e1',
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  statusBtnResolve: {
    background: 'rgba(34,197,94,0.18)', color: '#86efac',
    border: '1px solid rgba(34,197,94,0.6)',
  },
};
