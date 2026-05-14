import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

const CHANNELS = [
  { id: 'email', label: 'Email' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'in_app', label: 'In-App' },
];

/**
 * NotificationPreferences — multi-select channel toggles.
 *
 * Props:
 *   value: string[]   array of enabled channel ids
 *   onChange: (next:string[]) => void
 *   disabled?: bool
 */
export default function NotificationPreferences({
  value = [],
  onChange,
  disabled = false,
}) {
  const isOn = (id) => value.includes(id);

  const toggle = (id) => {
    if (disabled) return;
    const next = isOn(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange?.(next);
  };

  return (
    <div style={S.box}>
      <h3 style={S.title}>알림 채널</h3>
      <p style={S.hint}>알림을 받을 채널을 모두 선택하세요.</p>
      <div style={S.row}>
        {CHANNELS.map((c) => {
          const on = isOn(c.id);
          return (
            <label
              key={c.id}
              style={{
                ...S.chip,
                background: on ? `${colors.accentCyan}26` : colors.bgPrimary,
                borderColor: on ? colors.accentCyan : colors.borderLight,
                color: on ? colors.accentCyan200 : colors.textSecondary,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(c.id)}
                disabled={disabled}
                style={S.checkbox}
              />
              {c.label}
            </label>
          );
        })}
      </div>
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
  title: {
    margin: 0,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  hint: {
    margin: 0,
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    border: '1px solid',
    borderRadius: borderRadius.md,
    minHeight: '44px',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: colors.accentCyan,
    cursor: 'inherit',
  },
};
