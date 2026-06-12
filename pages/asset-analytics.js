// Asset Master — Phase 3-4 Performance Dashboard
// Route: /asset-analytics
//
// Renders:
//   - Lifecycle KPI cards (avg lifespan, disposal rate, premature %)
//   - Lifecycle by group (table)
//   - Edit-pattern velocity (per-day avg, peak day/hour)
//   - Field volatility (top changed fields + transitions)
//
// Server data comes from:
//   /api/assets/analytics/lifecycle
//   /api/assets/analytics/edit-patterns

import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import BottomNav from '../components/BottomNav';

const TIME_RANGES = [
  { key: 'week', label: '7일' },
  { key: 'month', label: '30일' },
  { key: 'quarter', label: '90일' },
  { key: 'year', label: '1년' },
];

const GROUP_BYS = [
  { key: 'category', label: '카테고리' },
  { key: 'location', label: '위치' },
  { key: 'status', label: '상태' },
];

function fetchJson(url) {
  return fetch(url, { cache: 'no-store' }).then((r) => r.json());
}

export default function AssetAnalyticsPage() {
  const [groupBy, setGroupBy] = useState('category');
  const [timeRange, setTimeRange] = useState('month');
  const [lifecycle, setLifecycle] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson(`/api/asset-analytics/lifecycle?group_by=${encodeURIComponent(groupBy)}`),
      fetchJson(`/api/asset-analytics/edit-patterns?time_range=${encodeURIComponent(timeRange)}`),
    ])
      .then(([lc, pt]) => {
        if (cancelled) return;
        setLifecycle(lc);
        setPatterns(pt);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'fetch failed');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupBy, timeRange]);

  const stats = lifecycle?.lifecycle_stats;
  const byGroup = lifecycle?.by_group || [];
  const editAvailable = patterns?.available !== false;
  const velocity = patterns?.edit_velocity;
  const volatility = patterns?.field_volatility || [];

  return (
    <>
      <Head>
        <title>자산 성과 대시보드 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backLink} aria-label="홈">← 홈</Link>
          <h1 style={S.title}>자산 성과 대시보드</h1>
          <span style={S.badge}>Phase 3-4</span>
        </header>

        {/* ── Lifecycle controls ───────────────────────────────────── */}
        <section style={S.section}>
          <div style={S.sectionTitle}>자산 수명주기</div>
          <div style={S.chipRow}>
            {GROUP_BYS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroupBy(g.key)}
                style={{ ...S.chip, ...(groupBy === g.key ? S.chipActive : null) }}
              >
                {g.label}
              </button>
            ))}
          </div>

          {error && <div style={S.errorBox}>{error}</div>}
          {loading && <div style={S.loading}>불러오는 중…</div>}

          {!loading && stats && (
            <>
              <div style={S.kpiGrid}>
                <KpiCard label="총 등록" value={stats.total_assets_created} suffix="대" />
                <KpiCard label="가동중" value={stats.active_assets} suffix="대" tone="green" />
                <KpiCard label="폐기" value={stats.total_disposed} suffix="대" tone="red" />
                <KpiCard
                  label="폐기율"
                  value={stats.disposal_rate_percent}
                  suffix="%"
                  tone={stats.disposal_rate_percent > 10 ? 'red' : 'amber'}
                />
                <KpiCard
                  label="평균 수명"
                  value={stats.average_lifespan_days}
                  suffix="일"
                  tone="amber"
                />
                <KpiCard
                  label="조기폐기"
                  value={stats.premature_disposals}
                  suffix="건"
                  tone="red"
                  hint="<1년"
                />
              </div>

              {byGroup.length > 0 && (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>{GROUP_BYS.find((g) => g.key === groupBy)?.label}</th>
                        <th style={S.thRight}>등록</th>
                        <th style={S.thRight}>폐기</th>
                        <th style={S.thRight}>폐기율</th>
                        <th style={S.thRight}>평균수명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byGroup.slice(0, 30).map((g) => (
                        <tr key={g.key}>
                          <td style={S.td}>{g.key}</td>
                          <td style={S.tdRight}>{g.created}</td>
                          <td style={S.tdRight}>{g.disposed}</td>
                          <td
                            style={{
                              ...S.tdRight,
                              color: g.disposal_rate_percent > 10 ? '#fca5a5' : '#cbd5e1',
                            }}
                          >
                            {g.disposal_rate_percent}%
                          </td>
                          <td style={S.tdRight}>{g.avg_lifespan_days || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Edit Patterns ────────────────────────────────────────── */}
        <section style={S.section}>
          <div style={S.sectionTitle}>편집 패턴</div>
          <div style={S.chipRow}>
            {TIME_RANGES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTimeRange(t.key)}
                style={{ ...S.chip, ...(timeRange === t.key ? S.chipActive : null) }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!editAvailable && (
            <div style={S.warnBox}>
              asset_edit_history 테이블이 아직 없습니다. Supabase SQL Editor에서{' '}
              <code style={S.code}>db/46_asset_master_phase3_schema.sql</code>을 실행하세요.
            </div>
          )}

          {editAvailable && !loading && patterns && (
            <>
              <div style={S.kpiGrid}>
                <KpiCard label="총 편집" value={patterns.total_edits} suffix="건" />
                <KpiCard
                  label="일평균"
                  value={velocity?.edits_per_day_avg ?? 0}
                  suffix="건/일"
                  tone="amber"
                />
                <KpiCard label="피크요일" value={velocity?.peak_day_of_week || '—'} />
                <KpiCard
                  label="피크시간"
                  value={velocity?.peak_hour_utc != null ? `${velocity.peak_hour_utc}:00` : '—'}
                  hint="UTC"
                />
              </div>

              {volatility.length > 0 && (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>필드</th>
                        <th style={S.thRight}>변경수</th>
                        <th style={S.th}>주요 전환 (top 3)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {volatility.slice(0, 15).map((f) => (
                        <tr key={f.field_name}>
                          <td style={S.td}>
                            <span style={S.fieldPill}>{f.field_name}</span>
                          </td>
                          <td style={S.tdRight}>{f.change_frequency}</td>
                          <td style={S.td}>
                            {f.common_transitions.slice(0, 3).map((t, i) => (
                              <div key={i} style={S.transitionRow}>
                                <span style={S.mono}>{t.transition}</span>
                                <span style={S.transitionCount}>×{t.count}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <div style={S.footnote}>
          Source: <code style={S.code}>/api/asset-analytics/lifecycle</code> ·{' '}
          <code style={S.code}>/api/asset-analytics/edit-patterns</code>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function KpiCard({ label, value, suffix, hint, tone }) {
  const valueColor =
    tone === 'red' ? '#fca5a5' : tone === 'green' ? '#86efac' : tone === 'amber' ? '#fbbf24' : '#f1f5f9';
  return (
    <div style={S.kpiCard}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, color: valueColor }}>
        {value}
        {suffix && <span style={S.kpiSuffix}>{suffix}</span>}
      </div>
      {hint && <div style={S.kpiHint}>{hint}</div>}
    </div>
  );
}

const S = {
  page: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a',
    minHeight: '100vh',
    color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480,
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
  title: { flex: 1, fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(220,38,38,0.18)',
    color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.5)',
  },
  section: { padding: '16px 14px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    minHeight: 32,
    padding: '6px 12px',
    borderRadius: 999,
    background: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: { background: '#dc2626', color: '#fff', borderColor: '#dc2626' },

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    background: '#1e293b',
    border: '1px solid #1f2937',
    borderRadius: 10,
    padding: '12px 12px',
  },
  kpiLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: 0.4 },
  kpiValue: { fontSize: 22, fontWeight: 700, marginTop: 4, lineHeight: 1.1 },
  kpiSuffix: { fontSize: 12, color: '#94a3b8', marginLeft: 3, fontWeight: 500 },
  kpiHint: { fontSize: 10, color: '#64748b', marginTop: 2 },

  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid #1f2937' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#1e293b' },
  th: {
    textAlign: 'left',
    padding: '10px 10px',
    color: '#94a3b8',
    fontWeight: 700,
    borderBottom: '1px solid #334155',
    background: '#0f172a',
  },
  thRight: {
    textAlign: 'right',
    padding: '10px 10px',
    color: '#94a3b8',
    fontWeight: 700,
    borderBottom: '1px solid #334155',
    background: '#0f172a',
  },
  td: { padding: '8px 10px', color: '#e2e8f0', borderBottom: '1px solid #1f2937' },
  tdRight: {
    padding: '8px 10px',
    color: '#e2e8f0',
    textAlign: 'right',
    borderBottom: '1px solid #1f2937',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },

  fieldPill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 6,
    background: 'rgba(59,130,246,0.18)',
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: 700,
  },
  transitionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    padding: '2px 0',
  },
  mono: {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    fontSize: 11,
    color: '#cbd5e1',
  },
  transitionCount: { fontSize: 11, color: '#94a3b8', fontWeight: 700 },

  loading: { padding: 24, textAlign: 'center', color: '#64748b' },
  errorBox: {
    margin: '0 0 12px',
    padding: 12,
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 10,
    fontSize: 13,
  },
  warnBox: {
    margin: '0 0 12px',
    padding: 12,
    background: 'rgba(234,179,8,0.12)',
    color: '#fde68a',
    border: '1px solid rgba(234,179,8,0.4)',
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 1.5,
  },
  code: {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    background: '#0f172a',
    padding: '1px 5px',
    borderRadius: 4,
    fontSize: 11,
    color: '#f1f5f9',
  },
  footnote: { padding: '4px 14px 16px', fontSize: 10, color: '#64748b' },
};
