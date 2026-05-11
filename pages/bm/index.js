import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';

const SEVERITY_STYLES = {
  minor:     { bg: '#f1f5f9', fg: '#475569' },
  normal:    { bg: '#dbeafe', fg: '#1e40af' },
  major:     { bg: '#fef3c7', fg: '#92400e' },
  line_down: { bg: '#fee2e2', fg: '#991b1b' },
};
const STATUS_STYLES = {
  open:          { bg: '#fee2e2', fg: '#991b1b', label: 'OPEN' },
  in_progress:   { bg: '#fef3c7', fg: '#92400e', label: 'IN PROGRESS' },
  pending_parts: { bg: '#fde68a', fg: '#7c2d12', label: 'WAIT PARTS' },
  resolved:      { bg: '#dcfce7', fg: '#166534', label: 'RESOLVED' },
  wontfix:       { bg: '#e5e7eb', fg: '#374151', label: "WON'T FIX" },
};

export default function BMListPage() {
  const { isAuthed, employeeId, fullName, signOut } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('open'); // open | all | resolved
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('bm_events')
        .select('id, asset_id, reported_at, reporter_name, severity, symptom, status, resolved_at, assets(machine_asset_number, name_en, location)')
        .order('reported_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      setEvents(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (filter === 'open' && !['open', 'in_progress', 'pending_parts'].includes(e.status)) return false;
      if (filter === 'resolved' && e.status !== 'resolved') return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          e.symptom, e.assets?.machine_asset_number, e.assets?.name_en, e.assets?.location, e.reporter_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, filter, search]);

  return (
    <>
      <Head>
        <title>BM History | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backLink}>← Home</Link>
          <h1 style={S.title}>BM History</h1>
          {isAuthed ? (
            <button onClick={signOut} style={S.userChip} title={fullName || 'logged in'}>
              {employeeId || '✓'}
            </button>
          ) : (
            <Link href="/login" style={S.loginLink}>Sign in</Link>
          )}
        </header>

        <div style={S.actionBar}>
          {isAuthed && (
            <Link href="/bm/new" style={S.newBtn}>+ Report BM</Link>
          )}
        </div>

        <div style={S.searchWrap}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search asset / symptom…"
            style={S.search}
            inputMode="search"
          />
        </div>

        <div style={S.chipRow}>
          {['open', 'resolved', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              ...S.chip, ...(filter === f ? S.chipActive : null),
            }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={S.countBar}>
          <strong>{filtered.length}</strong> / {events.length} events
        </div>

        {error && <div style={S.errorBox}>{error}<div style={{fontSize:11, marginTop:6, opacity:0.8}}>Has `05_bm_schema.sql` been run in Supabase?</div></div>}
        {loading && <div style={S.loading}>Loading…</div>}
        {!loading && !error && filtered.length === 0 && <div style={S.empty}>No events</div>}

        <ul style={S.list}>
          {filtered.map(e => (
            <li key={e.id} style={S.card}>
              <Link href={`/bm/${e.id}`} style={S.cardLink}>
                <div style={S.cardTop}>
                  <span style={{ ...S.sevPill, background: SEVERITY_STYLES[e.severity]?.bg, color: SEVERITY_STYLES[e.severity]?.fg }}>
                    {e.severity.toUpperCase()}
                  </span>
                  <span style={{ ...S.statusPill, background: STATUS_STYLES[e.status]?.bg, color: STATUS_STYLES[e.status]?.fg }}>
                    {STATUS_STYLES[e.status]?.label || e.status}
                  </span>
                </div>
                <div style={S.assetLine}>
                  <strong>{e.assets?.machine_asset_number}</strong> · {e.assets?.name_en}
                </div>
                <div style={S.symptom}>{e.symptom}</div>
                <div style={S.meta}>
                  {new Date(e.reported_at).toLocaleString()} {e.reporter_name && `· ${e.reporter_name}`}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
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
  userChip: {
    background: '#22c55e', color: '#fff', border: 'none', borderRadius: 999,
    padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  loginLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 13,
    padding: '6px 10px', border: '1px solid #334155', borderRadius: 6,
  },
  actionBar: { padding: '10px 16px 0' },
  newBtn: {
    display: 'inline-block', background: '#dc2626', color: '#fff',
    padding: '12px 18px', borderRadius: 10, fontSize: 15, fontWeight: 700,
    textDecoration: 'none',
  },
  searchWrap: { padding: '12px 16px 0' },
  search: {
    width: '100%', padding: '12px 14px',
    border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 16,
    outline: 'none', background: '#fff', boxSizing: 'border-box',
  },
  chipRow: { display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto' },
  chip: {
    padding: '6px 12px', borderRadius: 999,
    border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer',
    flexShrink: 0, fontWeight: 600,
  },
  chipActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  countBar: { padding: '8px 16px', fontSize: 13, color: '#475569', borderBottom: '1px solid #e2e8f0' },
  errorBox: { margin: 16, padding: 14, background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 14 },
  loading: { padding: 32, textAlign: 'center', color: '#64748b' },
  empty: { padding: 32, textAlign: 'center', color: '#64748b' },
  list: { listStyle: 'none', margin: 0, padding: '12px 16px' },
  card: { background: '#fff', borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' },
  cardLink: { display: 'block', padding: 14, textDecoration: 'none', color: 'inherit' },
  cardTop: { display: 'flex', gap: 8, marginBottom: 8 },
  sevPill: { padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  statusPill: { padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  assetLine: { fontSize: 14, color: '#0f172a', marginBottom: 4 },
  symptom: { fontSize: 14, color: '#334155', wordBreak: 'break-word', marginBottom: 6 },
  meta: { fontSize: 11, color: '#94a3b8' },
};
