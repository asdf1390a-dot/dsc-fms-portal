import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

/**
 * RetentionSetting — slider + text input for retention days (7..3650).
 *
 * Props:
 *   days: number
 *   onChange: (days:number) => void
 *   min?: number (default 7)
 *   max?: number (default 3650)
 *   recommended?: number (default 90)  shows warning if days < recommended
 *   disabled?: boolean
 */
export default function RetentionSetting({
  days,
  onChange,
  min = 7,
  max = 3650,
  recommended = 90,
  disabled = false,
}) {
  const clamp = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, Math.round(v)));
  };

  const handle = (val) => {
    const v = clamp(val);
    onChange?.(v);
  };

  const showWarn = Number(days) > 0 && Number(days) < recommended;

  return (
    <div style={S.box}>
      <div style={S.headerRow}>
        <label style={S.label} htmlFor="retention-input">보관 기간 (일)</label>
        <input
          id="retention-input"
          type="number"
          min={min}
          max={max}
          step={1}
          value={days ?? ''}
          onChange={(e) => handle(e.target.value)}
          disabled={disabled}
          style={S.numInput}
        />
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={days ?? min}
        onChange={(e) => handle(e.target.value)}
        disabled={disabled}
        style={S.slider}
      />

      <div style={S.range}>
        <span style={S.rangeText}>{min}일</span>
        <span style={S.rangeText}>{max}일 (10년)</span>
      </div>

      {showWarn && (
        <div style={S.warn}>
          ⚠ {recommended}일 이상 보관을 권장합니다.
        </div>
      )}
    </div>
  );
}

const S = {
  box: {
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
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  numInput: {
    width: '110px',
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: '16px',
    color: colors.textPrimary,
    background: colors.bgPrimary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    minHeight: '44px',
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    accentColor: colors.accentCyan,
    cursor: 'pointer',
  },
  range: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  rangeText: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  warn: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizes.sm,
    color: colors.warning,
    background: `${colors.warning}1a`,
    border: `1px solid ${colors.warning}`,
    borderRadius: borderRadius.md,
  },
};
