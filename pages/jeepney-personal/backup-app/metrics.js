import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import {
  MetricsSummary,
  MetricsChart,
  PerformanceCard,
  DownloadCSVButton,
} from '../../../components/backup';
import { colors, spacing, typography, borderRadius } from '../../../lib/design-tokens';
import { useAuth } from '../../../lib/use-auth';
import { apiGet } from '../../../lib/backup-fetch';

export default function BackupMetricsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  const PERIOD_LIMITS = { 7: 7, 30: 30, 90: 90, all: 365 };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/jeepney-personal/backup-app/metrics')}`);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const limit = PERIOD_LIMITS[period] || 30;
        const [s, d] = await Promise.all([
          apiGet('/api/backup/metrics/summary'),
          apiGet(`/api/backup/metrics/daily?limit=${limit}`),
        ]);
        setSummary(s);
        setDaily(d.metrics || []);
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, router, period]);

  return (
    <JeepneyLayout
      title="백업 통계"
      level={4}
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'Backup App', href: '/jeepney-personal/backup-app' },
        { label: '통계' },
      ]}
    >
      <section style={S.header}>
        <div>
          <h2 style={S.title}>백업 통계</h2>
          <p style={S.subtitle}>
            {period === 'all' ? '전체' : `최근 ${period}일`} 백업 성능 및 추이
          </p>
        </div>
        <DownloadCSVButton rows={daily} disabled={loading || daily.length === 0} />
      </section>

      <div style={S.periodSelector}>
        {[7, 30, 90, 'all'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              ...S.periodBtn,
              ...(period === p ? S.periodBtnActive : S.periodBtnInactive),
            }}
          >
            {p === 'all' ? '전체' : `${p}일`}
          </button>
        ))}
      </div>

      {error && (
        <div style={S.errBox}>
          <p style={S.errText}>오류: {error}</p>
        </div>
      )}

      {loading ? (
        <div style={S.center}>로딩 중…</div>
      ) : !summary && daily.length === 0 ? (
        <div style={S.emptyState}>
          <p style={S.emptyStateText}>아직 백업 메트릭 데이터가 없습니다.</p>
          <p style={S.emptyStateHint}>백업이 실행되면 통계가 나타납니다.</p>
        </div>
      ) : (
        <div style={S.stack}>
          {summary && <MetricsSummary metrics={summary} />}
          <MetricsChart daily_data={daily} />
          {summary && (
            <PerformanceCard
              avg_duration_seconds={summary.avg_duration_seconds || 0}
              max_duration_seconds={summary.max_duration_seconds || 0}
            />
          )}
        </div>
      )}
    </JeepneyLayout>
  );
}

const S = {
  header: {
    marginBottom: spacing['2xl'],
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    margin: `${spacing.sm} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  periodSelector: {
    display: 'flex',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  periodBtn: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  periodBtnActive: {
    background: colors.primary,
    color: colors.bgPrimary,
    border: `1px solid ${colors.primary}`,
  },
  periodBtnInactive: {
    background: colors.bgPrimary,
    color: colors.textPrimary,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['2xl'],
  },
  errBox: {
    padding: spacing.lg,
    background: `${colors.error}20`,
    border: `1px solid ${colors.error}`,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  errText: {
    margin: 0,
    color: colors.error,
    fontSize: typography.sizes.sm,
  },
  center: {
    textAlign: 'center',
    padding: spacing['3xl'],
    color: colors.textSecondary,
  },
  emptyState: {
    padding: spacing.xl,
    background: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    border: `1px solid ${colors.borderLight}`,
  },
  emptyStateText: {
    margin: 0,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  emptyStateHint: {
    margin: `${spacing.sm} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
};
