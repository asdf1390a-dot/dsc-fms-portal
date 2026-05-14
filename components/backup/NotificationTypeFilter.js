import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

const OPTIONS = [
  { value: '', label: '전체' },
  { value: 'success', label: '성공' },
  { value: 'failure', label: '실패' },
  { value: 'quota_warning', label: '할당량 경고' },
  { value: 'quota_exceeded', label: '할당량 초과' },
  { value: 'deletion_scheduled', label: '삭제 예정' },
];

/**
 * NotificationTypeFilter — dropdown + unread toggle.
 *
 * Props:
 *   type: string ('' = all)
 *   onTypeChange: (next:string) => void
 *   unreadOnly: bool
 *   onUnreadChange: (next:bool) => void
 */
export default function NotificationTypeFilter({
  type = '',
  onTypeChange,
  unreadOnly = false,
  onUnreadChange,
}) {
  return (
    <div style={S.row}>
      <label style={S.label}>
        <span style={S.labelText}>유형</span>
        <select
          value={type}
          onChange={(e) => onTypeChange?.(e.target.value)}
          style={S.select}
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <label style={S.checkLabel}>
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => onUnreadChange?.(e.target.checked)}
          style={S.checkbox}
        />
        <span style={S.labelText}>안 읽음만 보기</span>
      </label>
    </div>
  );
}

const S = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  labelText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  select: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: '16px',
    background: colors.bgPrimary,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    minHeight: '40px',
    cursor: 'pointer',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: colors.accentCyan,
    cursor: 'pointer',
  },
};
