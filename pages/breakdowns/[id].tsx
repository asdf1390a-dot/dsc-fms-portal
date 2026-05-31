// pages/breakdowns/[id].tsx
// BM-P1 Phase 2 — M3.2 Breakdown Detail Page.
// Read-only summary + timeline + photo gallery + documents + edit/delete (RBAC).
// Mobile-first inline-CSS-in-JS dark theme. Embeds <UpdateBreakdownForm /> on edit.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import BottomNav from '../../components/BottomNav';
import UpdateBreakdownForm from '../../components/bm/UpdateBreakdownForm';
import { useAuth } from '../../lib/use-auth';
import {
  useBreakdownById,
  deleteBreakdown,
  STATUS_COLORS,
  SEVERITY_COLORS,
  BreakdownReport,
} from '../../lib/hooks/useBreakdowns';

export default function BreakdownDetailPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;

  const { isAuthed, fullName, employeeId, role, signOut } = useAuth();
  const isAdmin = role === 'admin' || role === 'manager';

  const { data, loading, error, refresh } = useBreakdownById(id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (!isAuthed || !data) return false;
    if (isAdmin) return true;
    return data.reported_by === employeeId || data.assigned_to === employeeId;
  }, [isAuthed, isAdmin, employeeId, data]);

  const canDelete = isAdmin;

  async function onDelete() {
    if (!data) return;
    const ok = typeof window !== 'undefined'
      ? window.confirm('Delete this breakdown report? This cannot be undone.')
      : false;
    if (!ok) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteBreakdown(data.id);
      router.replace('/breakdowns');
    } catch (e: any) {
      setDeleteErr(e?.message || String(e));
      setDeleting(false);
    }
  }

  return (
    <>
      <Head>
        <title>{data ? `BM ${data.machine_asset_number || ''} — ${shortDesc(data.description)}` : 'Breakdown'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={S.page}>
        {/* Header */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <Link href="/breakdowns" style={S.backLink} aria-label="Back to list">
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </Link>
            <div style={S.title}>Breakdown Detail</div>
            <div style={S.headerRight}>
              {isAuthed ? (
                <>
                  <span style={S.userChip} title={fullName || ''}>{shortName(fullName)}</span>
                  <button type="button" onClick={signOut} style={S.logoutBtn}>Logout</button>
                </>
              ) : (
                <Link href="/login" style={S.loginLink}>Login</Link>
              )}
            </div>
          </div>
        </header>

        <main style={S.main}>
          {loading && <div style={S.notice}>Loading…</div>}
          {error && (
            <div style={S.errorBox} role="alert">
              <strong>Could not load breakdown.</strong>
              <div style={{ marginTop: 4, fontSize: 13 }}>{error}</div>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Asset summary */}
              <section style={S.card} aria-label="Asset summary">
                <div style={S.cardHeader}>
                  <div style={S.assetTitleBlock}>
                    <div style={S.assetCode}>{data.machine_asset_number || '—'}</div>
                    <div style={S.assetName}>{data.asset_name || 'Unknown asset'}</div>
                  </div>
                  <div style={S.badgeRow}>
                    <StatusBadge status={data.status} />
                    <SeverityBadge severity={data.severity} />
                  </div>
                </div>
                {data.asset_id && (
                  <div style={S.assetLinkRow}>
                    <Link href={`/assets/${data.asset_id}`} style={S.assetLink}>
                      View asset →
                    </Link>
                  </div>
                )}
              </section>

              {/* Actions */}
              {(canEdit || canDelete) && !editing && (
                <section style={S.actionsRow} aria-label="Actions">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      style={S.primaryBtn}
                      aria-label="Edit breakdown"
                    >
                      Edit / Update Status
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={deleting}
                      style={{ ...S.dangerBtn, opacity: deleting ? 0.6 : 1 }}
                      aria-label="Delete breakdown"
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </section>
              )}
              {deleteErr && (
                <div style={S.errorBox} role="alert">{deleteErr}</div>
              )}

              {/* Inline edit form */}
              {editing && (
                <section style={S.card} aria-label="Update breakdown">
                  <h2 style={S.sectionH2}>Update Breakdown</h2>
                  <UpdateBreakdownForm
                    breakdown={data}
                    isAdmin={isAdmin}
                    onCancel={() => setEditing(false)}
                    onSuccess={() => {
                      setEditing(false);
                      refresh();
                    }}
                  />
                </section>
              )}

              {/* Description */}
              <section style={S.card} aria-label="Description">
                <h2 style={S.sectionH2}>Description</h2>
                <div style={S.descBlock}>
                  <div style={S.descLabel}>EN</div>
                  <p style={S.descText}>{data.description || '—'}</p>
                </div>
                {data.description_ta && (
                  <div style={S.descBlock}>
                    <div style={S.descLabel}>TA</div>
                    <p style={S.descText} lang="ta">{data.description_ta}</p>
                  </div>
                )}
                {data.category && (
                  <div style={S.metaRow}>
                    <span style={S.metaLabel}>Category</span>
                    <span style={S.metaValue}>{prettyCategory(data.category)}</span>
                  </div>
                )}
              </section>

              {/* Timeline */}
              <section style={S.card} aria-label="Timeline">
                <h2 style={S.sectionH2}>Timeline</h2>
                <Timeline data={data} />
                {typeof data.duration_minutes === 'number' && data.duration_minutes >= 0 && (
                  <div style={S.durationBox}>
                    <span style={S.durationLabel}>Downtime</span>
                    <span style={S.durationValue}>{fmtDuration(data.duration_minutes)}</span>
                  </div>
                )}
              </section>

              {/* Photos */}
              {Array.isArray(data.photos) && data.photos.length > 0 && (
                <section style={S.card} aria-label="Photo gallery">
                  <h2 style={S.sectionH2}>Photos ({data.photos.length})</h2>
                  <div style={S.gallery}>
                    {data.photos.map((url, i) => (
                      <button
                        key={`${url}-${i}`}
                        type="button"
                        style={S.galleryItem}
                        onClick={() => setLightbox(url)}
                        aria-label={`Open photo ${i + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Breakdown photo ${i + 1}`} style={S.galleryImg} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Documents */}
              {Array.isArray(data.documents) && data.documents.length > 0 && (
                <section style={S.card} aria-label="Documents">
                  <h2 style={S.sectionH2}>Documents ({data.documents.length})</h2>
                  <ul style={S.docList}>
                    {data.documents.map((url, i) => (
                      <li key={`${url}-${i}`} style={S.docItem}>
                        <a href={url} target="_blank" rel="noopener noreferrer" style={S.docLink}>
                          <span aria-hidden="true" style={S.docIcon}>📄</span>
                          <span style={S.docName}>{filenameFromUrl(url) || `Document ${i + 1}`}</span>
                          <span style={S.docArrow} aria-hidden="true">↗</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Root cause / action taken */}
              {(data.root_cause || data.action_taken) && (
                <section style={S.card} aria-label="Resolution">
                  <h2 style={S.sectionH2}>Root Cause &amp; Action</h2>
                  {data.root_cause && (
                    <div style={S.descBlock}>
                      <div style={S.descLabel}>Root cause</div>
                      <p style={S.descText}>{data.root_cause}</p>
                    </div>
                  )}
                  {data.action_taken && (
                    <div style={S.descBlock}>
                      <div style={S.descLabel}>Action taken</div>
                      <p style={S.descText}>{data.action_taken}</p>
                    </div>
                  )}
                </section>
              )}

              {/* People */}
              <section style={S.card} aria-label="People">
                <h2 style={S.sectionH2}>People</h2>
                <div style={S.metaGrid}>
                  <PersonRow label="Reported by" name={data.reporter_name} id={data.reported_by} />
                  <PersonRow label="Assigned to" name={data.assignee_name} id={data.assigned_to} />
                  <PersonRow label="Resolved by" name={data.resolver_name} id={data.resolved_by} />
                </div>
              </section>
            </>
          )}
        </main>

        {/* Lightbox */}
        {lightbox && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
            style={S.lightbox}
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Photo" style={S.lightboxImg} />
            <button type="button" style={S.lightboxClose} onClick={() => setLightbox(null)} aria-label="Close">
              ✕
            </button>
          </div>
        )}

        <BottomNav />
      </div>
    </>
  );
}

// ── Small components ───────────────────────────────────────────────
function StatusBadge({ status }: { status: BreakdownReport['status'] }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.reported;
  return (
    <span style={{
      ...badgeBase,
      color: c.fg,
      background: c.bg,
      border: `1px solid ${c.border}`,
    }} aria-label={`Status ${c.label}`}>
      {c.label}
    </span>
  );
}
function SeverityBadge({ severity }: { severity: BreakdownReport['severity'] }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.normal;
  return (
    <span style={{
      ...badgeBase,
      color: c.fg,
      background: c.bg,
      border: `1px solid ${c.border}`,
    }} aria-label={`Severity ${c.label}`}>
      {c.label}
    </span>
  );
}

function Timeline({ data }: { data: BreakdownReport }) {
  const steps = [
    { key: 'reported',     label: 'Reported',     at: data.reported_at || data.created_at },
    { key: 'acknowledged', label: 'Acknowledged', at: data.acknowledged_at || null },
    { key: 'started',      label: 'Work started', at: data.started_at || null },
    { key: 'resolved',     label: data.status === 'won_fix' ? "Won't fix" : 'Resolved', at: data.resolved_at || null },
  ];
  return (
    <ol style={S.timeline}>
      {steps.map((s, i) => {
        const done = !!s.at;
        return (
          <li key={s.key} style={S.tlItem}>
            <div style={{
              ...S.tlDot,
              background: done ? '#22c55e' : '#1f2937',
              border: done ? '2px solid #22c55e' : '2px solid #334155',
            }} aria-hidden="true" />
            {i < steps.length - 1 && (
              <div style={{
                ...S.tlLine,
                background: done ? '#22c55e' : '#334155',
              }} aria-hidden="true" />
            )}
            <div style={S.tlBody}>
              <div style={S.tlLabel}>{s.label}</div>
              <div style={S.tlTime}>{s.at ? fmtDT(s.at) : '—'}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PersonRow({ label, name, id }: { label: string; name?: string | null; id?: string | null }) {
  return (
    <div style={S.personRow}>
      <span style={S.metaLabel}>{label}</span>
      <span style={S.metaValue}>
        {name || '—'}
        {id && (
          <span style={S.personId} aria-label={`Employee ID ${id}`}>
            {' '}({id})
          </span>
        )}
      </span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
function shortDesc(s: string | undefined | null): string {
  if (!s) return '';
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
}
function shortName(s: string | null | undefined): string {
  if (!s) return 'User';
  const t = String(s).trim();
  return t.length > 16 ? `${t.slice(0, 14)}…` : t;
}
function prettyCategory(c: string): string {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
function fmtDT(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}
function filenameFromUrl(u: string): string | null {
  try {
    const url = new URL(u);
    const parts = url.pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1] || '');
  } catch {
    const parts = String(u).split('/');
    return parts[parts.length - 1] || null;
  }
}

// ── Styles ─────────────────────────────────────────────────────────
const badgeBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
};

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    paddingBottom: 80,
    fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    maxWidth: 960,
    margin: '0 auto',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: '#93c5fd',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    minHeight: 44,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: 700,
    color: '#f1f5f9',
    textAlign: 'center',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  loginLink: {
    color: '#93c5fd',
    textDecoration: 'none',
    fontSize: 14,
    padding: '8px 10px',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
  },
  userChip: {
    fontSize: 12,
    color: '#cbd5e1',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 999,
    padding: '4px 10px',
  },
  logoutBtn: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    padding: '6px 10px',
    cursor: 'pointer',
    minHeight: 32,
  },
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  notice: {
    padding: '20px',
    textAlign: 'center',
    color: '#94a3b8',
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 12,
  },
  errorBox: {
    padding: 12,
    border: '1px solid rgba(220,38,38,0.6)',
    background: 'rgba(220,38,38,0.12)',
    color: '#fca5a5',
    borderRadius: 10,
    fontSize: 14,
  },
  card: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assetTitleBlock: {
    minWidth: 0,
  },
  assetCode: {
    fontSize: 13,
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  assetName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f1f5f9',
    marginTop: 2,
  },
  badgeRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  assetLinkRow: {
    marginTop: 8,
  },
  assetLink: {
    color: '#93c5fd',
    fontSize: 13,
    textDecoration: 'none',
  },
  actionsRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flex: '1 1 auto',
    minHeight: 44,
    padding: '0 14px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerBtn: {
    minHeight: 44,
    padding: '0 14px',
    background: 'transparent',
    color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.6)',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  sectionH2: {
    margin: '0 0 10px',
    fontSize: 13,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  descBlock: {
    marginBottom: 10,
  },
  descLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  descText: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.5,
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  metaRow: {
    display: 'flex',
    gap: 8,
    fontSize: 13,
    marginTop: 6,
  },
  metaLabel: {
    color: '#94a3b8',
    minWidth: 110,
  },
  metaValue: {
    color: '#e2e8f0',
  },
  metaGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  personRow: {
    display: 'flex',
    fontSize: 14,
  },
  personId: {
    color: '#64748b',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
    fontSize: 12,
  },
  timeline: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    position: 'relative',
  },
  tlItem: {
    position: 'relative',
    paddingLeft: 28,
    paddingBottom: 14,
    minHeight: 38,
  },
  tlDot: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 14,
    height: 14,
    borderRadius: '50%',
    boxSizing: 'border-box',
  },
  tlLine: {
    position: 'absolute',
    left: 10,
    top: 18,
    width: 2,
    bottom: 0,
  },
  tlBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  tlLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  tlTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  durationBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #1f2937',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  durationValue: {
    fontSize: 16,
    color: '#fdba74',
    fontWeight: 700,
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  gallery: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))',
    gap: 8,
  },
  galleryItem: {
    padding: 0,
    border: '1px solid #1f2937',
    borderRadius: 8,
    background: '#0f172a',
    cursor: 'pointer',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
  },
  galleryImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  docList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  docItem: {
    border: '1px solid #1f2937',
    borderRadius: 8,
    background: '#0f172a',
  },
  docLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 12px',
    color: '#93c5fd',
    textDecoration: 'none',
    minHeight: 44,
  },
  docIcon: {
    fontSize: 18,
  },
  docName: {
    flex: 1,
    fontSize: 14,
    wordBreak: 'break-all',
  },
  docArrow: {
    fontSize: 14,
    color: '#64748b',
  },
  lightbox: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    cursor: 'zoom-out',
  },
  lightboxImg: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  lightboxClose: {
    position: 'fixed',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#e2e8f0',
    fontSize: 18,
    cursor: 'pointer',
  },
};
