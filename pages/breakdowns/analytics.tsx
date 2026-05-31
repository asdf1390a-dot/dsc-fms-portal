// pages/breakdowns/analytics.tsx
// BM-P1 Phase 2 — M3.5 Analytics Dashboard.
// Overall metrics card + severity pie + monthly trend line + top assets bar + per-asset table.
// Date range filter, CSV export. Mobile-first dark theme, recharts for visualization.

import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import BottomNav from '../../components/BottomNav';
import { useAuth } from '../../lib/use-auth';
import {
  useBreakdownAnalytics,
  AnalyticsSummary,
  OverallMetrics,
  SEVERITY_COLORS,
  BreakdownSeverity,
} from '../../lib/hooks/useBreakdowns';

const SEV_ORDER: BreakdownSeverity[] = ['line_down', 'major', 'normal', 'minor'];
const SEV_CHART: Record<BreakdownSeverity, string> = {
  line_down: '#dc2626',
  major: '#f97316',
  normal: '#64748b',
  minor: '#06b6d4',
};

export default function BreakdownAnalyticsPage() {
  const { isAuthed, fullName, signOut } = useAuth();

  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFromDate = new Date(today.getTime() - 90 * 86400000);
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const apiParams = useMemo(() => ({
    reported_from: dateFrom || undefined,
    reported_to: dateTo ? `${dateTo}T23:59:59` : undefined,
    limit: 200,
    offset: 0,
  }), [dateFrom, dateTo]);

  const { data, overall, loading, error } = useBreakdownAnalytics(apiParams);

  // ── Derived: severity distribution from overall ───────────────────
  const severityChartData = useMemo(() => {
    if (!overall) return [];
    return SEV_ORDER.map((k) => ({
      key: k,
      name: SEVERITY_COLORS[k].label,
      value: overall.severity_distribution[k] || 0,
      color: SEV_CHART[k],
    })).filter((r) => r.value > 0);
  }, [overall]);

  // ── Derived: monthly trend (aggregate across assets) ──────────────
  const monthlyTrend = useMemo(() => {
    const m: Record<string, { month: string; total: number; resolved: number; downtime: number }> = {};
    for (const r of data) {
      const key = r.month;
      if (!m[key]) m[key] = { month: key, total: 0, resolved: 0, downtime: 0 };
      m[key].total += r.summary.total_breakdowns;
      m[key].resolved += r.summary.resolved_count;
      m[key].downtime += r.performance_metrics.total_downtime_minutes;
    }
    return Object.values(m)
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .map((r) => ({ ...r, monthLabel: r.month.slice(0, 7) }));
  }, [data]);

  // ── Derived: top assets by total breakdowns ───────────────────────
  const topAssets = useMemo(() => {
    const byAsset: Record<string, {
      asset_id: string;
      machine_asset_number: string;
      asset_name: string;
      total: number;
      resolved: number;
      downtime: number;
    }> = {};
    for (const r of data) {
      const k = r.asset_id;
      if (!byAsset[k]) {
        byAsset[k] = {
          asset_id: r.asset_id,
          machine_asset_number: r.machine_asset_number,
          asset_name: r.asset_name,
          total: 0,
          resolved: 0,
          downtime: 0,
        };
      }
      byAsset[k].total += r.summary.total_breakdowns;
      byAsset[k].resolved += r.summary.resolved_count;
      byAsset[k].downtime += r.performance_metrics.total_downtime_minutes;
    }
    return Object.values(byAsset)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [data]);

  function exportCSV() {
    if (typeof window === 'undefined') return;
    const rows: string[] = [];
    rows.push('asset_id,machine_asset_number,asset_name,month,total,resolved,open,resolution_rate,line_down,major,normal,minor,avg_mttr_min,total_downtime_min');
    for (const r of data) {
      rows.push([
        r.asset_id,
        csvEscape(r.machine_asset_number),
        csvEscape(r.asset_name),
        r.month,
        r.summary.total_breakdowns,
        r.summary.resolved_count,
        r.summary.open_count,
        r.summary.resolution_rate,
        r.severity_distribution.line_down,
        r.severity_distribution.major,
        r.severity_distribution.normal,
        r.severity_distribution.minor,
        r.performance_metrics.avg_mttr_minutes ?? '',
        r.performance_metrics.total_downtime_minutes,
      ].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breakdown-analytics_${dateFrom}_to_${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <Head>
        <title>Breakdown Analytics</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={S.page}>
        <header style={S.header}>
          <div style={S.headerInner}>
            <Link href="/breakdowns" style={S.backLink} aria-label="Back to list">
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </Link>
            <div style={S.title}>Breakdown Analytics</div>
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
          {/* Filters */}
          <section style={S.card} aria-label="Filters">
            <div style={S.filterRow}>
              <label style={S.filterField}>
                <span style={S.filterLabel}>From</span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={S.input}
                  aria-label="Date from"
                />
              </label>
              <label style={S.filterField}>
                <span style={S.filterLabel}>To</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={S.input}
                  aria-label="Date to"
                />
              </label>
              <button
                type="button"
                onClick={exportCSV}
                disabled={loading || data.length === 0}
                style={{ ...S.csvBtn, opacity: loading || data.length === 0 ? 0.5 : 1 }}
                aria-label="Export to CSV"
              >
                ↓ CSV
              </button>
            </div>
          </section>

          {error && (
            <div style={S.errorBox} role="alert">
              <strong>Could not load analytics.</strong>
              <div style={{ marginTop: 4, fontSize: 13 }}>{error}</div>
            </div>
          )}

          {/* Overall metrics card */}
          <section style={S.card} aria-label="Overall metrics">
            <h2 style={S.sectionH2}>Overall</h2>
            {loading ? (
              <div style={S.notice}>Loading…</div>
            ) : overall ? (
              <div style={S.metricsGrid}>
                <Metric label="Total" value={String(overall.total_breakdowns)} />
                <Metric label="Resolved" value={String(overall.resolved_count)} accent="#22c55e" />
                <Metric label="Open" value={String(overall.open_count)} accent="#fdba74" />
                <Metric label="Resolution rate" value={`${overall.resolution_rate}%`} />
                <Metric label="Avg MTTR" value={overall.avg_mttr_minutes != null ? fmtMins(overall.avg_mttr_minutes) : '—'} />
                <Metric label="Total downtime" value={fmtMins(overall.total_downtime_minutes)} />
              </div>
            ) : (
              <div style={S.notice}>No data in range.</div>
            )}
          </section>

          {/* Severity distribution */}
          <section style={S.card} aria-label="Severity distribution">
            <h2 style={S.sectionH2}>Severity Distribution</h2>
            {severityChartData.length === 0 ? (
              <div style={S.notice}>No data.</div>
            ) : (
              <div style={S.chartWrap}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={severityChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(d) => `${d.name}: ${d.value}`}
                      labelLine={false}
                    >
                      {severityChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend
                      wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Monthly trend */}
          <section style={S.card} aria-label="Monthly trend">
            <h2 style={S.sectionH2}>Monthly Trend</h2>
            {monthlyTrend.length === 0 ? (
              <div style={S.notice}>No data.</div>
            ) : (
              <div style={S.chartWrap}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={monthlyTrend} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={{ color: '#e2e8f0' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Top assets bar chart */}
          <section style={S.card} aria-label="Top assets">
            <h2 style={S.sectionH2}>Top Assets by Breakdowns</h2>
            {topAssets.length === 0 ? (
              <div style={S.notice}>No data.</div>
            ) : (
              <div style={S.chartWrap}>
                <ResponsiveContainer width="100%" height={Math.max(200, topAssets.length * 32 + 40)}>
                  <BarChart
                    data={topAssets}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 12, bottom: 4 }}
                  >
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <YAxis
                      dataKey="machine_asset_number"
                      type="category"
                      stroke="#94a3b8"
                      fontSize={11}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={{ color: '#e2e8f0' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Bar dataKey="total" name="Breakdowns" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Per-asset table */}
          <section style={S.card} aria-label="Per-asset summary">
            <h2 style={S.sectionH2}>Per-Asset Summary</h2>
            {data.length === 0 && !loading ? (
              <div style={S.notice}>No data.</div>
            ) : (
              <div style={S.tableScroll}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Asset</th>
                      <th style={S.th}>Month</th>
                      <th style={S.thNum}>Total</th>
                      <th style={S.thNum}>Resolved</th>
                      <th style={S.thNum}>Open</th>
                      <th style={S.thNum}>Resolution %</th>
                      <th style={S.thNum}>Avg MTTR</th>
                      <th style={S.thNum}>Downtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={`${r.asset_id}-${r.month}-${i}`} style={i % 2 ? S.trAlt : undefined}>
                        <td style={S.td}>
                          <div style={S.assetCode}>{r.machine_asset_number || '—'}</div>
                          <div style={S.assetSubtle}>{r.asset_name}</div>
                        </td>
                        <td style={S.td}>{r.month.slice(0, 7)}</td>
                        <td style={S.tdNum}>{r.summary.total_breakdowns}</td>
                        <td style={S.tdNum}>{r.summary.resolved_count}</td>
                        <td style={S.tdNum}>{r.summary.open_count}</td>
                        <td style={S.tdNum}>{r.summary.resolution_rate}%</td>
                        <td style={S.tdNum}>
                          {r.performance_metrics.avg_mttr_minutes != null
                            ? fmtMins(r.performance_metrics.avg_mttr_minutes)
                            : '—'}
                        </td>
                        <td style={S.tdNum}>{fmtMins(r.performance_metrics.total_downtime_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>

        <BottomNav />
      </div>
    </>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────
function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={S.metricCell}>
      <div style={S.metricLabel}>{label}</div>
      <div style={{ ...S.metricValue, color: accent || '#f1f5f9' }}>{value}</div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
function csvEscape(s: string | null | undefined): string {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function fmtMins(mins: number): string {
  if (!Number.isFinite(mins) || mins < 0) return '—';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}
function shortName(s: string | null | undefined): string {
  if (!s) return 'User';
  const t = String(s).trim();
  return t.length > 16 ? `${t.slice(0, 14)}…` : t;
}

// ── Styles ─────────────────────────────────────────────────────────
const chartTooltipStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
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
  card: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: 14,
  },
  sectionH2: {
    margin: '0 0 10px',
    fontSize: 13,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: '1 1 140px',
    minWidth: 140,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    background: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 16, // ≥16px so iOS doesn't zoom
    minHeight: 44,
  },
  csvBtn: {
    minHeight: 44,
    padding: '0 14px',
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBox: {
    padding: 12,
    border: '1px solid rgba(220,38,38,0.6)',
    background: 'rgba(220,38,38,0.12)',
    color: '#fca5a5',
    borderRadius: 10,
    fontSize: 14,
  },
  notice: {
    padding: '14px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  },
  metricCell: {
    background: '#0f172a',
    border: '1px solid #1f2937',
    borderRadius: 10,
    padding: '12px 14px',
  },
  metricLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f1f5f9',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  chartWrap: {
    width: '100%',
  },
  tableScroll: {
    overflowX: 'auto',
    margin: '0 -4px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    minWidth: 640,
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderBottom: '1px solid #1f2937',
    background: '#0f172a',
    position: 'sticky',
    top: 0,
  },
  thNum: {
    textAlign: 'right',
    padding: '8px 10px',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderBottom: '1px solid #1f2937',
    background: '#0f172a',
    position: 'sticky',
    top: 0,
  },
  trAlt: {
    background: '#0f172a',
  },
  td: {
    padding: '10px',
    borderBottom: '1px solid #1f2937',
    color: '#e2e8f0',
    verticalAlign: 'top',
  },
  tdNum: {
    padding: '10px',
    borderBottom: '1px solid #1f2937',
    color: '#e2e8f0',
    textAlign: 'right',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  assetCode: {
    fontWeight: 600,
    color: '#f1f5f9',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  assetSubtle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
};
