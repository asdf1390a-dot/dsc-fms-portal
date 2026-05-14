import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

function formatBytes(bytes) {
  if (bytes == null) return '—';
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * QuotaCard — current storage usage vs max quota with progress bar.
 *
 * Props:
 *   max_bytes: number|null      null/0 = unlimited
 *   current_bytes: number
 *   warning_threshold: number   percent (default 80)
 *   plan_type?: string          optional badge text
 */
export default function QuotaCard({
  max_bytes,
  current_bytes = 0,
  warning_threshold = 80,
  plan_type,
}) {
  const max = Number(max_bytes);
  const cur = Number(current_bytes) || 0;
  const unlimited = !max || max <= 0;
  const pct = unlimited
    ? 0
    : Math.min(100, Math.round((cur / max) * 1000) / 10);

  let color = colors.success;
  if (!unlimited) {
    if (pct >= 100) color = colors.error;
    else if (pct >= warning_threshold) color = colors.warning;
  }

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <h3 style={S.title}>저장소 사용량</h3>
        {plan_type && <span style={S.plan}>{plan_type}</span>}
      </div>

      <div style={S.usageRow}>
        <span style={{ ...S.usageText, color }}>
          {formatBytes(cur)}
          {!unlimited && <span style={S.divider}> / {formatBytes(max)}</span>}
          {unlimited && <span style={S.divider}> / 무제한</span>}
        </span>
        {!unlimited && (
          <span style={{ ...S.pctText, color }}>{pct}%</span>
        )}
      </div>

      <div style={S.barBg}>
        <div
          style={{
            ...S.barFill,
            width: unlimited ? '0%' : `${pct}%`,
            background: color,
          }}
        />
      </div>

      {!unlimited && (
        <p style={S.hint}>
          경고 임계치: {warning_threshold}%
          {pct >= 100 && ' • 할당량 초과'}
          {pct >= warning_threshold && pct < 100 && ' • 임계치 도달'}
        </p>
      )}
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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  plan: {
    fontSize: typography.sizes.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    background: colors.bgTertiary,
    color: colors.textSecondary,
    borderRadius: borderRadius.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  usageRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  usageText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  divider: {
    color: colors.textTertiary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
  },
  pctText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  barBg: {
    width: '100%',
    height: '10px',
    background: colors.bgPrimary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    border: `1px solid ${colors.borderLight}`,
  },
  barFill: {
    height: '100%',
    transition: 'width 300ms ease-out, background 200ms',
    borderRadius: borderRadius.full,
  },
  hint: {
    margin: 0,
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
};
