import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '0초';
  if (s < 60) return `${Math.round(s)}초`;
  if (s < 3600) return `${(s / 60).toFixed(1)}분`;
  return `${(s / 3600).toFixed(1)}시간`;
}

/**
 * PerformanceCard — average vs max backup duration.
 *
 * Props:
 *   avg_duration_seconds: number
 *   max_duration_seconds: number
 */
export default function PerformanceCard({
  avg_duration_seconds = 0,
  max_duration_seconds = 0,
}) {
  return (
    <div style={S.card}>
      <h3 style={S.title}>성능</h3>
      <div style={S.row}>
        <div style={S.metric}>
          <p style={S.label}>평균 소요시간</p>
          <p style={{ ...S.value, color: colors.info }}>
            {formatDuration(avg_duration_seconds)}
          </p>
        </div>
        <div style={S.divider} />
        <div style={S.metric}>
          <p style={S.label}>최대 소요시간</p>
          <p style={{ ...S.value, color: colors.warning }}>
            {formatDuration(max_duration_seconds)}
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.lg,
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
  title: {
    margin: 0,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  row: {
    display: 'flex',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  metric: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  divider: {
    width: '1px',
    background: colors.borderLight,
  },
  label: {
    margin: 0,
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  value: {
    margin: 0,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
  },
};
