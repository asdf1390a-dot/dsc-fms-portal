import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';

const STATUS_FLOW = {
  open:          ['in_progress', 'pending_parts', 'resolved', 'wontfix'],
  in_progress:   ['pending_parts', 'resolved', 'open'],
  pending_parts: ['in_progress', 'resolved'],
  resolved:      ['in_progress'],
  wontfix:       ['open'],
};
const STATUS_LABEL = {
  open: 'Open', in_progress: 'In Progress', pending_parts: 'Wait Parts',
  resolved: 'Resolved', wontfix: "Won't Fix",
};
const STATUS_STYLES = {
  open:          { bg: '#fee2e2', fg: '#991b1b' },
  in_progress:   { bg: '#fef3c7', fg: '#92400e' },
  pending_parts: { bg: '#fde68a', fg: '#7c2d12' },
  resolved:      { bg: '#dcfce7', fg: '#166534' },
  wontfix:       { bg: '#e5e7eb', fg: '#374151' },
};

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('bm_events')
        .select('*, assets(machine_asset_number, name_en, location)')
        .eq('id', id).maybeSingle();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data) { setError('Not found'); setLoading(false); return; }
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
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = user?.id;
        patch.resolver_name = fullName || user?.email;
      }
      const { data, error } = await supabase.from('bm_events').update(patch).eq('id', event.id).select().single();
      if (error) throw error;
      setEvent(prev => ({ ...prev, ...data, assets: prev.assets }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
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
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const st = event ? STATUS_STYLES[event.status] : null;
  const nextStatuses = event ? (STATUS_FLOW[event.status] || []) : [];

  return (
    <>
      <Head>
        <title>{event ? `BM #${String(event.id).slice(0, 6)}` : 'BM'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/bm" style={S.backLink}>← BM</Link>
          <h1 style={S.title}>BM Event</h1>
        </header>

        {loading && <div style={S.loading}>Loading…</div>}
        {error && <div style={S.error}>{error}</div>}

        {event && (
          <div style={S.content}>
            <div style={S.statusCard}>
              <span style={{ ...S.statusBadge, background: st.bg, color: st.fg }}>
                {STATUS_LABEL[event.status]}
              </span>
              <span style={S.severity}>{event.severity.toUpperCase()}</span>
            </div>

            <Section title="Asset">
              <Link href={`/assets/${encodeURIComponent(event.assets?.machine_asset_number || '')}`} style={S.assetLink}>
                <strong>{event.assets?.machine_asset_number}</strong>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{event.assets?.name_en}</div>
                {event.assets?.location && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{event.assets?.location}</div>}
              </Link>
            </Section>

            <Section title="Symptom">
              <div style={S.text}>{event.symptom}</div>
            </Section>

            <Section title="Action Taken">
              {isAuthed ? (
                <>
                  <textarea value={action} onChange={(e) => setAction(e.target.value)}
                    placeholder="What did you do?"
                    style={{ ...S.input, height: 90, resize: 'vertical', fontFamily: 'inherit' }} />
                </>
              ) : (
                <div style={S.text}>{event.action_taken || <em style={{color:'#94a3b8'}}>(none)</em>}</div>
              )}
            </Section>

            <Section title="Root Cause">
              {isAuthed ? (
                <textarea value={cause} onChange={(e) => setCause(e.target.value)}
                  placeholder="Why did it happen?"
                  style={{ ...S.input, height: 80, resize: 'vertical', fontFamily: 'inherit' }} />
              ) : (
                <div style={S.text}>{event.cause || <em style={{color:'#94a3b8'}}>(none)</em>}</div>
              )}
            </Section>

            {isAuthed && (
              <button onClick={saveNotes} disabled={busy} style={{ ...S.saveBtn, ...(busy ? S.btnDisabled : null) }}>
                {busy ? 'Saving…' : 'Save notes'}
              </button>
            )}

            <Section title="Timeline">
              <Row label="Reported" value={`${new Date(event.reported_at).toLocaleString()}${event.reporter_name ? ` · ${event.reporter_name}` : ''}`} />
              {event.resolved_at && (
                <Row label="Resolved" value={`${new Date(event.resolved_at).toLocaleString()}${event.resolver_name ? ` · ${event.resolver_name}` : ''}`} />
              )}
              {event.downtime_minutes != null && (
                <Row label="Downtime" value={`${event.downtime_minutes} min`} />
              )}
            </Section>

            {isAuthed && nextStatuses.length > 0 && (
              <Section title="Change Status">
                <div style={S.statusActions}>
                  {nextStatuses.map(s => (
                    <button key={s} onClick={() => changeStatus(s)} disabled={busy} style={{
                      ...S.statusActionBtn,
                      ...(s === 'resolved' ? { background: '#22c55e', color: '#fff', borderColor: '#22c55e' } : null),
                    }}>
                      → {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </Section>
            )}
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

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: '#94a3b8', minWidth: 80 }}>{label}</span>
      <span style={{ color: '#0f172a', flex: 1 }}>{value}</span>
    </div>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
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
  error: { margin: 16, padding: 14, background: '#fee2e2', color: '#991b1b', borderRadius: 10 },
  content: { padding: 16 },

  statusCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  statusBadge: { padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700 },
  severity: { fontSize: 12, color: '#64748b', fontWeight: 700 },

  section: { background: '#fff', borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' },
  sectionTitle: { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  sectionBody: { padding: 14 },

  assetLink: { display: 'block', textDecoration: 'none', color: '#0f172a' },
  text: { fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap' },
  input: {
    width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#f8fafc',
  },
  saveBtn: {
    width: '100%', padding: '12px 18px', background: '#0f172a', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    marginBottom: 12,
  },
  btnDisabled: { background: '#cbd5e1', color: '#64748b', cursor: 'not-allowed' },

  statusActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  statusActionBtn: {
    padding: '12px', border: '2px solid #cbd5e1', background: '#fff', color: '#0f172a',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};
