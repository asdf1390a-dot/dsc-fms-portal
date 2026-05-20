import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';

const STATUS_STYLES = {
  active:      { bg: '#dcfce7', fg: '#166534', label: 'ACTIVE' },
  idle:        { bg: '#fef3c7', fg: '#92400e', label: 'IDLE' },
  maintenance: { bg: '#dbeafe', fg: '#1e40af', label: 'MAINT' },
  sold:        { bg: '#e5e7eb', fg: '#374151', label: 'SOLD' },
  scrapped:    { bg: '#fee2e2', fg: '#991b1b', label: 'SCRAP' },
};

const T = {
  title:      { en: 'Assets',         ta: 'சொத்துக்கள்' },
  search:     { en: 'Search…',        ta: 'தேடு…' },
  all:        { en: 'All',             ta: 'அனைத்தும்' },
  total:      { en: 'shown',           ta: 'காட்டப்பட்டது' },
  loading:    { en: 'Loading…',        ta: 'ஏற்றுகிறது…' },
  noResults:  { en: 'No matches',      ta: 'பொருத்தம் இல்லை' },
  location:   { en: 'Location',        ta: 'இடம்' },
  make:       { en: 'Make',            ta: 'தயாரிப்பு' },
  model:      { en: 'Model',           ta: 'மாடல்' },
  serial:     { en: 'Serial',          ta: 'சீரியல்' },
  category:   { en: 'Category',        ta: 'வகை' },
  status:     { en: 'Status',          ta: 'நிலை' },
};

const t = (key, lang) => T[key]?.[lang] || T[key]?.en || key;

export default function AssetsPage() {
  const [lang, setLang] = useState('en'); // 'en' | 'ta'
  const { isAuthed, employeeId, fullName, signOut } = useAuth();
  const [assets, setAssets] = useState([]);
  const [classes, setClasses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [pmStatusMap, setPmStatusMap] = useState({}); // asset_id → 'completed'|'pending'|'overdue'|null
  const [bmStatusMap, setBmStatusMap] = useState({}); // asset_id → 'open'|null

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fetch all assets with pagination to handle 1000+ row limit
      const pageSize = 500;
      let allAssets = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && !cancelled) {
        const { data, error } = await supabase.from('assets')
          .select('id, machine_asset_code, machine_asset_number, asset_class_code, serial_no, name_en, name_ta, model, make, location, status, remark')
          .order('machine_asset_code')
          .range(offset, offset + pageSize - 1);

        if (error) {
          setError(error.message);
          setLoading(false);
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

      const [c, cats] = await Promise.all([
        supabase.from('asset_classes').select('code, category_code, name_en'),
        supabase.from('categories').select('code, name_en, name_ko').order('code'),
      ]);

      if (cancelled) return;
      setAssets(allAssets);
      setClasses(c.data || []);
      setCategories(cats.data || []);
      setLoading(false);

      // Lightweight async fetch of PM/BM status indicators.
      // 실패시 무시 — 리스트 표시에는 영향 없음.
      const todayStr = new Date().toISOString().slice(0, 10);
      Promise.all([
        supabase.from('pm_schedules')
          .select('asset_id, status, scheduled_date')
          .in('status', ['pending', 'in_progress', 'completed'])
          .gte('scheduled_date', new Date(Date.now() - 90*86400*1000).toISOString().slice(0, 10))
          .limit(5000),
        supabase.from('bm_events')
          .select('asset_id, status')
          .in('status', ['open', 'in_progress', 'pending_parts'])
          .limit(2000),
      ]).then(([pmRes, bmRes]) => {
        if (cancelled) return;
        const pm = {};
        for (const r of (pmRes.data || [])) {
          if (!r.asset_id) continue;
          const cur = pm[r.asset_id];
          // priority: overdue > pending > completed
          let lvl = 0;
          if (r.status === 'pending' && r.scheduled_date < todayStr) lvl = 3; // overdue
          else if (r.status === 'pending' || r.status === 'in_progress') lvl = 2;
          else if (r.status === 'completed') lvl = 1;
          if (!cur || lvl > cur.lvl) {
            const tag = lvl === 3 ? 'overdue' : lvl === 2 ? 'pending' : 'completed';
            pm[r.asset_id] = { lvl, tag };
          }
        }
        const pmFlat = {};
        Object.entries(pm).forEach(([k, v]) => { pmFlat[k] = v.tag; });
        const bm = {};
        for (const r of (bmRes.data || [])) {
          if (!r.asset_id) continue;
          bm[r.asset_id] = 'open';
        }
        setPmStatusMap(pmFlat);
        setBmStatusMap(bm);
      }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, []);

  const classByCode = useMemo(() => {
    const m = new Map();
    for (const cl of classes) m.set(cl.code, cl);
    return m;
  }, [classes]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter(a => {
      if (cat !== 'all' && !(a.asset_class_code || '').startsWith(cat + '.') && a.asset_class_code !== cat) return false;
      if (status !== 'all' && a.status !== status) return false;
      if (needle) {
        const hay = [
          a.machine_asset_number, a.machine_asset_code, a.serial_no,
          a.name_en, a.name_ta, a.model, a.make, a.location, a.remark,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [assets, q, cat, status]);

  return (
    <>
      <Head>
        <title>DSC FMS — Assets</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backLink}>← Home</Link>
          <h1 style={S.title}>{t('title', lang)}</h1>
          <button
            onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
            style={S.langBtn}
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'EN · த' : 'த · EN'}
          </button>
          {isAuthed ? (
            <button onClick={signOut} style={S.userChip} title={fullName || 'logged in — click to sign out'}>
              {employeeId || '✓'}
            </button>
          ) : (
            <Link href="/login" style={S.loginLink}>Sign in</Link>
          )}
        </header>

        {isAuthed && (
          <div style={S.actionBar}>
            <Link href="/assets/new" style={S.newBtn}>+ New Asset</Link>
          </div>
        )}

        <div style={S.searchWrap}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search', lang)}
            style={S.search}
            autoComplete="off"
            inputMode="search"
          />
          {q && (
            <button onClick={() => setQ('')} style={S.clearBtn} aria-label="Clear">×</button>
          )}
        </div>

        <div style={S.chipRow}>
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>{t('all', lang)}</Chip>
          {categories.map(c => (
            <Chip key={c.code} active={cat === c.code} onClick={() => setCat(c.code)}>
              {c.code} · {c.name_en}
            </Chip>
          ))}
        </div>

        <div style={S.chipRow}>
          {['all', 'active', 'idle', 'maintenance', 'sold', 'scrapped'].map(s => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {s === 'all' ? t('all', lang) : (STATUS_STYLES[s]?.label || s)}
            </Chip>
          ))}
        </div>

        <div style={S.countBar}>
          <span><strong>{filtered.length.toLocaleString()}</strong> / {assets.length.toLocaleString()} {t('total', lang)}</span>
        </div>

        {error && (
          <div style={S.errorBox}>
            <strong>Error:</strong> {error}
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.8 }}>
              Check that NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY env vars are set on Vercel.
            </div>
          </div>
        )}

        {loading && <div style={S.loading}>{t('loading', lang)}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div style={S.empty}>{t('noResults', lang)}</div>
        )}

        <ul style={S.list}>
          {filtered.map(a => (
            <li key={a.id} style={S.card}>
              <Link href={`/assets/${encodeURIComponent(a.machine_asset_number)}`} style={S.cardLink}>
                <div style={S.cardTop}>
                  <div style={S.tagBox}>
                    <span style={S.tag}>{a.machine_asset_number}</span>
                    <span style={S.tagSub}>{a.machine_asset_code}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <PmBmBadge pm={pmStatusMap[a.id]} bm={bmStatusMap[a.id]} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>

                <div style={S.name}>
                  {lang === 'ta' && a.name_ta ? a.name_ta : a.name_en}
                </div>
                {lang === 'ta' && a.name_ta && a.name_en !== a.name_ta && (
                  <div style={S.nameSub}>{a.name_en}</div>
                )}

                <div style={S.meta}>
                  {a.make && <Meta label={t('make', lang)} value={a.make} />}
                  {a.model && <Meta label={t('model', lang)} value={a.model} />}
                  {a.serial_no && <Meta label={t('serial', lang)} value={a.serial_no} />}
                  {a.location && <Meta label={t('location', lang)} value={a.location} />}
                  <Meta
                    label={t('category', lang)}
                    value={classByCode.get(a.asset_class_code)?.name_en || a.asset_class_code}
                  />
                  {a.remark && <Meta label="—" value={a.remark} />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...S.chip, ...(active ? S.chipActive : null) }}>
      {children}
    </button>
  );
}

function PmBmBadge({ pm, bm }) {
  // BM 우선 — 진행중 고장이 있으면 빨강 표시
  if (bm === 'open') {
    return (
      <span style={{
        backgroundColor: '#fee2e2', color: '#991b1b',
        padding: '4px 8px', borderRadius: 8,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }} title="BM 진행중">🔴 BM</span>
    );
  }
  if (pm === 'overdue') {
    return (
      <span style={{
        backgroundColor: '#fee2e2', color: '#991b1b',
        padding: '4px 8px', borderRadius: 8,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }} title="PM 연체">❌ PM</span>
    );
  }
  if (pm === 'pending') {
    return (
      <span style={{
        backgroundColor: '#fef3c7', color: '#92400e',
        padding: '4px 8px', borderRadius: 8,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }} title="PM 예정">⏱ PM</span>
    );
  }
  if (pm === 'completed') {
    return (
      <span style={{
        backgroundColor: '#dcfce7', color: '#166534',
        padding: '4px 8px', borderRadius: 8,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }} title="PM 완료">✓ PM</span>
    );
  }
  return null;
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span style={{
      backgroundColor: s.bg, color: s.fg,
      padding: '4px 10px', borderRadius: 8,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function Meta({ label, value }) {
  return (
    <div style={S.metaRow}>
      <span style={S.metaLabel}>{label}</span>
      <span style={S.metaValue}>{value}</span>
    </div>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", sans-serif',
    background: '#f8fafc',
    minHeight: '100vh',
    color: '#0f172a',
    paddingBottom: 80,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#0f172a', color: '#fff',
    padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  title: { fontSize: 18, fontWeight: 600, flex: 1, margin: 0 },
  langBtn: {
    background: '#334155', color: '#fff', border: 'none',
    padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
  },
  userChip: {
    background: '#22c55e', color: '#fff', border: 'none', borderRadius: 999,
    padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  loginLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 13,
    padding: '6px 10px', border: '1px solid #334155', borderRadius: 6,
  },
  actionBar: { padding: '10px 16px 0', background: '#f8fafc' },
  newBtn: {
    display: 'inline-block', background: '#0f172a', color: '#fff',
    padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
    textDecoration: 'none',
  },

  searchWrap: { padding: '12px 16px 0', position: 'relative' },
  search: {
    width: '100%', padding: '12px 36px 12px 14px',
    border: '1px solid #cbd5e1', borderRadius: 10,
    fontSize: 16, // 16+ prevents iOS zoom on focus
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  },
  clearBtn: {
    position: 'absolute', right: 24, top: '50%', transform: 'translateY(-25%)',
    background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: '#94a3b8',
  },

  chipRow: {
    display: 'flex', gap: 8, padding: '10px 16px',
    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    whiteSpace: 'nowrap',
  },
  chip: {
    padding: '6px 12px', borderRadius: 999,
    border: '1px solid #cbd5e1', background: '#fff',
    fontSize: 13, cursor: 'pointer',
    flexShrink: 0,
  },
  chipActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },

  countBar: {
    padding: '8px 16px', fontSize: 13, color: '#475569',
    borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
    background: '#fff',
  },

  errorBox: {
    margin: '16px', padding: 14,
    background: '#fee2e2', color: '#991b1b',
    borderRadius: 10, fontSize: 14,
  },
  loading: { padding: 32, textAlign: 'center', color: '#64748b' },
  empty: { padding: 32, textAlign: 'center', color: '#64748b' },

  list: { listStyle: 'none', margin: 0, padding: '12px 16px' },
  card: {
    background: '#fff', borderRadius: 12,
    marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  cardLink: {
    display: 'block', padding: 14, color: 'inherit', textDecoration: 'none',
  },
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 10, marginBottom: 6,
  },
  tagBox: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  tag: { fontWeight: 700, fontSize: 14, color: '#0f172a', wordBreak: 'break-all' },
  tagSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  name: { fontSize: 15, fontWeight: 500, marginTop: 6, color: '#1e293b' },
  nameSub: { fontSize: 12, color: '#64748b', marginTop: 2 },

  meta: { marginTop: 10, display: 'grid', gap: 4 },
  metaRow: { display: 'flex', gap: 8, fontSize: 12 },
  metaLabel: { color: '#94a3b8', minWidth: 70, flexShrink: 0 },
  metaValue: { color: '#334155', flex: 1, wordBreak: 'break-word' },
};
