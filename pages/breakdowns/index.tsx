// pages/breakdowns/index.tsx
// BM-P1 Phase 2 M3.1 — Breakdown List Page.
//
// Columns: Asset, Status, Severity, Reported, Duration, Actions.
// Filters: Status (multi-select), Severity (multi-select), Date range, search.
// Sortable headers, paginated 25/50/100, mobile-first card view on narrow screens.

import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import BottomNav from '../../components/BottomNav';
import {
  BreakdownReport,
  BreakdownSeverity,
  BreakdownStatus,
  SEVERITY_COLORS,
  STATUS_COLORS,
  useBreakdowns,
} from '../../lib/hooks/useBreakdowns';
import { useAuth } from '../../lib/use-auth';

const STATUS_OPTIONS: BreakdownStatus[] = [
  'reported',
  'acknowledged',
  'in_progress',
  'resolved',
  'won_fix',
];
const SEVERITY_OPTIONS: BreakdownSeverity[] = ['minor', 'normal', 'major', 'line_down'];

const PAGE_SIZES = [25, 50, 100];

type SortField = 'reported_at' | 'severity' | 'status' | 'duration_minutes';
type SortDir = 'asc' | 'desc';

export default function BreakdownListPage() {
  const { isAuthed, employeeId, fullName, signOut } = useAuth();

  // Filters
  const [statusFilter, setStatusFilter] = useState<BreakdownStatus[]>([]);
  const [severityFilter, setSeverityFilter] = useState<BreakdownSeverity[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Sort & paging
  const [sortBy, setSortBy] = useState<SortField>('reported_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  // Filter panel
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = useMemo(
    () => ({
      status: statusFilter.length ? statusFilter : undefined,
      severity: severityFilter.length ? severityFilter : undefined,
      reported_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      reported_to: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [statusFilter, severityFilter, dateFrom, dateTo, sortBy, sortDir, pageSize, page]
  );

  const { data, pagination, loading, error } = useBreakdowns(filters);

  // Client-side text search filter (server already returned a page).
  const visibleRows = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((r) => {
      const hay = [
        r.machine_asset_number,
        r.asset_name,
        r.description,
        r.id,
        r.reporter_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search]);

  function toggleStatus(s: BreakdownStatus) {
    setPage(0);
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  function toggleSeverity(s: BreakdownSeverity) {
    setPage(0);
    setSeverityFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  function clearFilters() {
    setStatusFilter([]);
    setSeverityFilter([]);
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(0);
  }
  function changeSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(0);
  }

  const total = pagination?.total ?? visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFiltersActive =
    statusFilter.length > 0 || severityFilter.length > 0 || !!dateFrom || !!dateTo || !!search;

  return (
    <>
      <Head>
        <title>Breakdowns | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backLink} aria-label="Home">
            ← Home
          </Link>
          <h1 style={S.title}>Breakdowns</h1>
          <div style={S.headerRight}>
            {isAuthed ? (
              <button onClick={signOut} style={S.userChip} title={fullName || 'Signed in'}>
                {employeeId || '✓'}
              </button>
            ) : (
              <Link href="/login" style={S.loginLink}>
                Login
              </Link>
            )}
            <Link href="/breakdowns/new" style={S.newBtn} aria-label="Report new breakdown">
              + New
            </Link>
          </div>
        </header>

        {/* Quick controls */}
        <div style={S.controlsRow}>
          <div style={S.searchWrap}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search asset / description / ID…"
              style={S.search}
              inputMode="search"
              aria-label="Search"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            style={S.filterToggle}
            aria-expanded={filtersOpen}
            aria-controls="bm-filters"
          >
            Filters{hasFiltersActive ? ' •' : ''}
          </button>
          <Link href="/breakdowns/analytics" style={S.analyticsBtn} aria-label="Analytics">
            📊
          </Link>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div id="bm-filters" style={S.filterPanel}>
            <div style={S.filterGroup}>
              <div style={S.filterLabel}>Status</div>
              <div style={S.chipRow}>
                {STATUS_OPTIONS.map((s) => {
                  const active = statusFilter.includes(s);
                  const sc = STATUS_COLORS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      style={{
                        ...S.chip,
                        background: active ? sc.bg : '#0f172a',
                        color: active ? sc.fg : '#94a3b8',
                        borderColor: active ? sc.border : '#334155',
                      }}
                      aria-pressed={active}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={S.filterGroup}>
              <div style={S.filterLabel}>Severity</div>
              <div style={S.chipRow}>
                {SEVERITY_OPTIONS.map((s) => {
                  const active = severityFilter.includes(s);
                  const sc = SEVERITY_COLORS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSeverity(s)}
                      style={{
                        ...S.chip,
                        background: active ? sc.bg : '#0f172a',
                        color: active ? sc.fg : '#94a3b8',
                        borderColor: active ? sc.border : '#334155',
                      }}
                      aria-pressed={active}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={S.filterGroup}>
              <div style={S.filterLabel}>Reported between</div>
              <div style={S.dateRow}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(0);
                  }}
                  style={S.dateInput}
                  aria-label="From date"
                />
                <span style={{ color: '#64748b' }}>~</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(0);
                  }}
                  style={S.dateInput}
                  aria-label="To date"
                />
              </div>
            </div>
            <div style={S.filterActions}>
              <button type="button" onClick={clearFilters} style={S.clearBtn}>
                Clear all
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={S.errorBox}>
            {error}
          </div>
        )}

        {/* Desktop / wide: table */}
        <div style={S.tableWrap} className="bm-table-wrap">
          <table style={S.table} role="table">
            <thead>
              <tr>
                <th style={S.th}>Asset</th>
                <th
                  style={{ ...S.th, ...S.thSortable }}
                  onClick={() => changeSort('status')}
                  aria-sort={
                    sortBy === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  Status {sortIndicator(sortBy === 'status', sortDir)}
                </th>
                <th
                  style={{ ...S.th, ...S.thSortable }}
                  onClick={() => changeSort('severity')}
                  aria-sort={
                    sortBy === 'severity' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  Severity {sortIndicator(sortBy === 'severity', sortDir)}
                </th>
                <th
                  style={{ ...S.th, ...S.thSortable }}
                  onClick={() => changeSort('reported_at')}
                  aria-sort={
                    sortBy === 'reported_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  Reported {sortIndicator(sortBy === 'reported_at', sortDir)}
                </th>
                <th
                  style={{ ...S.th, ...S.thSortable }}
                  onClick={() => changeSort('duration_minutes')}
                  aria-sort={
                    sortBy === 'duration_minutes'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  Duration {sortIndicator(sortBy === 'duration_minutes', sortDir)}
                </th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={S.td}>
                    <div style={S.loading}>Loading…</div>
                  </td>
                </tr>
              )}
              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={S.td}>
                    <div style={S.emptyMsg}>No breakdowns found.</div>
                  </td>
                </tr>
              )}
              {!loading &&
                visibleRows.map((r) => (
                  <BreakdownRow key={r.id} r={r} />
                ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: card list (hidden on wider via inline media queries are not possible without CSS files — duplicate render is fine and total nodes are bounded by pageSize). */}
        <ul style={S.cardList} className="bm-card-list">
          {loading && <li style={S.loading}>Loading…</li>}
          {!loading && visibleRows.length === 0 && (
            <li style={S.emptyMsg}>No breakdowns found.</li>
          )}
          {!loading &&
            visibleRows.map((r) => (
              <BreakdownCard key={r.id} r={r} />
            ))}
        </ul>

        {/* Pagination footer */}
        <div style={S.pagerRow}>
          <label style={S.pagerLabel}>
            Rows
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(0);
              }}
              style={S.pagerSelect}
              aria-label="Page size"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div style={S.pagerInfo}>
            {total === 0
              ? '0 / 0'
              : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`}
          </div>
          <div style={S.pagerButtons}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                ...S.pageBtn,
                opacity: page === 0 ? 0.4 : 1,
                cursor: page === 0 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span style={S.pagerLabel}>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              style={{
                ...S.pageBtn,
                opacity: (page + 1) * pageSize >= total ? 0.4 : 1,
                cursor: (page + 1) * pageSize >= total ? 'not-allowed' : 'pointer',
              }}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </main>
      <BottomNav />

      {/* Inline media query for table vs cards. */}
      <style jsx global>{`
        @media (max-width: 720px) {
          .bm-table-wrap { display: none !important; }
        }
        @media (min-width: 721px) {
          .bm-card-list { display: none !important; }
        }
      `}</style>
    </>
  );
}

function sortIndicator(active: boolean, dir: SortDir) {
  if (!active) return '↕';
  return dir === 'asc' ? '▲' : '▼';
}

function fmtDuration(min?: number | null) {
  if (min == null) return '—';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function StatusBadge({ status }: { status: BreakdownStatus }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.reported;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: BreakdownSeverity }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.normal;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}

function BreakdownRow({ r }: { r: BreakdownReport }) {
  return (
    <tr style={S.tr}>
      <td style={S.td}>
        <div style={S.assetCell}>
          <span style={S.assetCode}>{r.machine_asset_number || '—'}</span>
          {r.asset_name && <span style={S.assetName}> · {r.asset_name}</span>}
        </div>
        {r.description && <div style={S.desc}>{r.description}</div>}
      </td>
      <td style={S.td}>
        <StatusBadge status={r.status} />
      </td>
      <td style={S.td}>
        <SeverityBadge severity={r.severity} />
      </td>
      <td style={S.td}>
        <span style={S.dateText}>{fmtDate(r.reported_at)}</span>
      </td>
      <td style={S.td}>
        <span style={S.dateText}>{fmtDuration(r.duration_minutes)}</span>
      </td>
      <td style={S.td}>
        <Link href={`/breakdowns/${r.id}`} style={S.actionLink}>
          View
        </Link>
      </td>
    </tr>
  );
}

function BreakdownCard({ r }: { r: BreakdownReport }) {
  return (
    <li style={S.card}>
      <Link href={`/breakdowns/${r.id}`} style={S.cardLink}>
        <div style={S.cardTop}>
          <div style={S.pillRow}>
            <SeverityBadge severity={r.severity} />
            <StatusBadge status={r.status} />
          </div>
          <span style={S.timeAgo}>{fmtDuration(r.duration_minutes)}</span>
        </div>
        <div style={S.assetCell}>
          <span style={S.assetCode}>{r.machine_asset_number || '—'}</span>
          {r.asset_name && <span style={S.assetName}> · {r.asset_name}</span>}
        </div>
        {r.description && <div style={S.desc}>{r.description}</div>}
        <div style={S.cardMeta}>
          <span>{fmtDate(r.reported_at)}</span>
          {r.reporter_name && <span> · {r.reporter_name}</span>}
        </div>
      </Link>
    </li>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a',
    minHeight: '100vh',
    color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 1080,
    margin: '0 auto',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: '#0f172a',
    borderBottom: '1px solid #1f2937',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  backLink: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: 14,
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 4px',
  },
  title: { flex: 1, fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc', textAlign: 'center' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  userChip: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
  },
  loginLink: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: 12,
    padding: '6px 10px',
    border: '1px solid #334155',
    borderRadius: 6,
  },
  newBtn: {
    background: '#dc2626',
    color: '#fff',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    minHeight: 32,
  },
  controlsRow: { display: 'flex', gap: 8, padding: '12px 14px 8px', alignItems: 'center' },
  searchWrap: { flex: 1 },
  search: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #334155',
    borderRadius: 10,
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#1e293b',
    color: '#f1f5f9',
    minHeight: 44,
  },
  filterToggle: {
    padding: '0 14px',
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 44,
  },
  analyticsBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 18,
  },
  filterPanel: {
    margin: '0 14px 12px',
    background: '#1e293b',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    border: '1px solid',
    cursor: 'pointer',
    minHeight: 32,
  },
  dateRow: { display: 'flex', alignItems: 'center', gap: 8 },
  dateInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 16,
    outline: 'none',
    background: '#0b1220',
    color: '#f1f5f9',
    minHeight: 44,
    boxSizing: 'border-box',
  },
  filterActions: { display: 'flex', justifyContent: 'flex-end' },
  clearBtn: {
    padding: '8px 14px',
    background: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    minHeight: 36,
  },
  errorBox: {
    margin: 14,
    padding: 14,
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 10,
    fontSize: 14,
  },
  tableWrap: {
    margin: '0 14px',
    overflowX: 'auto',
    background: '#1e293b',
    border: '1px solid #1f2937',
    borderRadius: 12,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    background: '#0f172a',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    borderBottom: '1px solid #1f2937',
  },
  thSortable: { cursor: 'pointer', userSelect: 'none' },
  tr: { borderBottom: '1px solid #1f2937' },
  td: { padding: '12px 14px', verticalAlign: 'top', color: '#e2e8f0' },
  assetCell: { fontSize: 14, lineHeight: 1.3, wordBreak: 'break-word' },
  assetCode: {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    color: '#f8fafc',
    fontWeight: 700,
  },
  assetName: { color: '#cbd5e1' },
  desc: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 12,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  dateText: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, color: '#cbd5e1' },
  actionLink: {
    color: '#93c5fd',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 0',
  },
  cardList: { listStyle: 'none', margin: 0, padding: '4px 14px 16px' },
  card: {
    background: '#1e293b',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    border: '1px solid #1f2937',
  },
  cardLink: { display: 'block', padding: '14px', textDecoration: 'none', color: 'inherit', minHeight: 44 },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  timeAgo: { fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', paddingTop: 3 },
  cardMeta: { display: 'flex', gap: 6, fontSize: 11, color: '#64748b', marginTop: 6 },
  loading: { padding: 32, textAlign: 'center', color: '#64748b' },
  emptyMsg: { padding: 32, textAlign: 'center', color: '#64748b' },
  pagerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '12px 14px 0',
    flexWrap: 'wrap',
  },
  pagerLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#94a3b8',
  },
  pagerSelect: {
    background: '#1e293b',
    color: '#f1f5f9',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 14,
    minHeight: 32,
  },
  pagerInfo: { fontSize: 12, color: '#94a3b8' },
  pagerButtons: { display: 'flex', alignItems: 'center', gap: 6 },
  pageBtn: {
    width: 36,
    height: 36,
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#e2e8f0',
    borderRadius: 8,
    fontSize: 18,
  },
};
