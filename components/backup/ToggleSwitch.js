import React from 'react';
import { colors, spacing, typography, borderRadius, transitions } from '../../lib/design-tokens';

/**
 * ToggleSwitch — accessible on/off switch.
 *
 * Props:
 *   enabled: boolean              current state
 *   onChange: (next:boolean)=>void
 *   label?: string                visible label (default: '자동 백업 활성화')
 *   disabled?: boolean
 */
export default function ToggleSwitch({
  enabled,
  onChange,
  label = '자동 백업 활성화',
  disabled = false,
}) {
  const handleToggle = () => {
    if (disabled) return;
    onChange?.(!enabled);
  };

  return (
    <label style={{ ...S.row, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span style={S.label}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-disabled={disabled}
        onClick={handleToggle}
        disabled={disabled}
        style={{
          ...S.track,
          background: enabled ? colors.accentCyan : colors.bgTertiary,
          borderColor: enabled ? colors.accentCyan600 : colors.borderLight,
        }}
      >
        <span
          style={{
            ...S.thumb,
            transform: enabled ? 'translateX(22px)' : 'translateX(2px)',
          }}
        />
      </button>
    </label>
  );
}

const S = {
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.lg,
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
    minHeight: '44px',
  },
  label: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  track: {
    position: 'relative',
    width: '48px',
    height: '26px',
    borderRadius: borderRadius.full,
    border: '1px solid',
    cursor: 'pointer',
    padding: 0,
    transition: transitions.base,
    flexShrink: 0,
  },
  thumb: {
    position: 'absolute',
    top: '2px',
    left: 0,
    width: '20px',
    height: '20px',
    background: '#fff',
    borderRadius: borderRadius.full,
    transition: transitions.base,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
};
