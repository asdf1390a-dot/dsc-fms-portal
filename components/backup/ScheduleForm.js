import React, { useState, useEffect } from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';
import Button from '../ui/Button';

/**
 * ScheduleForm — time + interval picker for automatic backups.
 *
 * Props:
 *   time: string ('HH:MM')
 *   interval: 'daily' | 'weekly' | 'monthly'
 *   onSubmit: (time, interval) => void   called when user presses 저장
 *   disabled?: boolean
 *   saving?: boolean
 */
export default function ScheduleForm({
  time = '02:00',
  interval = 'daily',
  onSubmit,
  disabled = false,
  saving = false,
}) {
  const [t, setT] = useState(time);
  const [iv, setIv] = useState(interval);

  useEffect(() => setT(time), [time]);
  useEffect(() => setIv(interval), [interval]);

  const dirty = t !== time || iv !== interval;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    // normalize HH:MM
    if (!/^\d{2}:\d{2}$/.test(t)) return;
    onSubmit(t, iv);
  };

  return (
    <form onSubmit={handleSubmit} style={S.form}>
      <div style={S.row}>
        <label style={S.label} htmlFor="backup-time">백업 시간 (HH:MM)</label>
        <input
          id="backup-time"
          type="time"
          value={t}
          onChange={(e) => setT(e.target.value)}
          disabled={disabled || saving}
          style={S.input}
        />
      </div>

      <div style={S.row}>
        <label style={S.label} htmlFor="backup-interval">주기</label>
        <select
          id="backup-interval"
          value={iv}
          onChange={(e) => setIv(e.target.value)}
          disabled={disabled || saving}
          style={S.select}
        >
          <option value="daily">매일 (daily)</option>
          <option value="weekly">매주 (weekly)</option>
          <option value="monthly">매월 (monthly)</option>
        </select>
      </div>

      <div style={S.actions}>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={disabled || saving || !dirty}
        >
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </form>
  );
}

const S = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
    padding: spacing.lg,
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  input: {
    padding: `${spacing.md} ${spacing.md}`,
    fontSize: '16px', // prevent iOS zoom
    color: colors.textPrimary,
    background: colors.bgPrimary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    minHeight: '44px',
  },
  select: {
    padding: `${spacing.md} ${spacing.md}`,
    fontSize: '16px',
    color: colors.textPrimary,
    background: colors.bgPrimary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    minHeight: '44px',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
};
