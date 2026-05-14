import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

function formatBytes(n) {
  if (n == null) return '—';
  const b = Number(n);
  if (!Number.isFinite(b)) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '0s';
  if (s < 60) return `${Math.round(s)}초`;
  if (s < 3600) return `${(s / 60).toFixed(1)}분`;
  return `${(s / 3600).toFixed(1)}시간`;
}

/**
 * MetricsSummary — four stat cards for the last 30 days.
 *
 * Props:
 *   metrics: {
 *     total_backups, successful, failed, skipped,
 *     total_size_bytes, avg_duration_seconds, max_duration_seconds
 *   }
 */
export default function MetricsSummary({ metrics = {} }) {
  const {
    total_backups = 0,
    successful = 0,
    failed = 0,
    skipped = 0,
    total_size_bytes = 0,
    avg_duration_seconds = 0,
  } = metrics;

  const successRate =
    total_backups > 0 ? Math.round((successful / total_backups) * 100) : 0;

  const cards = [
    {
      label: '총 백업 (30일)',
      value: total_backups,
      tone: colors.accentCyan,
      sub: `평균 ${formatDuration(avg_duration_seconds)}`,
    },
    {
      label: '성공',
      value: successful,
      tone: colors.success,
      sub: `성공률 ${successRate}%`,
    },
    {
      label: '실패 / 스킵',
      value: `${failed} / ${skipped}`,
      tone: failed > 0 ? colors.error : colors.textTertiary,
      sub: failed > 0 ? '확인 필요' : '문제 없음',
    },
    {
      label: '총 크기',
      value: formatBytes(total_size_bytes),
      tone: colors.info,
      sub: '누적',
    },
  ];

  return (
    <div style={S.grid}>
      {cards.map((c, i) => (
        <div key={i} style={S.card}>
          <p style={S.label}>{c.label}</p>
          <p style={{ ...S.value, color: c.tone }}>{c.value}</p>
          <p style={S.sub}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

const S = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: spacing.lg,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    padding: spacing.lg,
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
  label: {
    margin: 0,
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: typography.weights.medium,
  },
  value: {
    margin: 0,
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.tight,
  },
  sub: {
    margin: 0,
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
};
