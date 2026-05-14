import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import {
  ToggleSwitch,
  ScheduleForm,
  RetentionSetting,
} from '../../../components/backup';
import { colors, spacing, typography, borderRadius } from '../../../lib/design-tokens';
import { useAuth } from '../../../lib/use-auth';
import { apiGet, apiPost } from '../../../lib/backup-fetch';

const DEFAULT_POLICY = {
  backup_enabled: false,
  backup_time: '02:00',
  backup_interval: 'daily',
  retention_days: 90,
  auto_delete_enabled: true,
  warning_threshold_percent: 80,
};

export default function AutoBackupSettings() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/jeepney-personal/backup-app/settings')}`);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const data = await apiGet('/api/backup/schedule/configure');
        setPolicy({ ...DEFAULT_POLICY, ...(data.policy || {}) });
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, router]);

  const save = async (patch) => {
    setSaving(true);
    setError(null);
    try {
      const merged = { ...policy, ...patch };
      // backup_time may come back as HH:MM:SS — normalize when sending.
      const payload = {
        backup_enabled: merged.backup_enabled,
        backup_time: (merged.backup_time || '02:00').slice(0, 5),
        backup_interval: merged.backup_interval,
        retention_days: merged.retention_days,
        auto_delete_enabled: merged.auto_delete_enabled,
        warning_threshold_percent: merged.warning_threshold_percent,
      };
      const data = await apiPost('/api/backup/schedule/configure', payload);
      setPolicy({ ...DEFAULT_POLICY, ...(data.policy || {}) });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt((v) => (Date.now() - v > 2500 ? null : v)), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <JeepneyLayout
      title="자동 백업 설정"
      level={4}
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'Backup App', href: '/jeepney-personal/backup-app' },
        { label: '설정' },
      ]}
    >
      <section style={S.header}>
        <h2 style={S.title}>자동 백업 설정</h2>
        <p style={S.subtitle}>
          백업 활성화, 스케줄, 보관 기간을 관리합니다.
        </p>
      </section>

      {error && (
        <div style={S.errBox}>
          <p style={S.errText}>오류: {error}</p>
        </div>
      )}

      {savedAt && (
        <div style={S.okBox}>
          <p style={S.okText}>저장되었습니다.</p>
        </div>
      )}

      {loading ? (
        <div style={S.center}>로딩 중…</div>
      ) : (
        <div style={S.stack}>
          <ToggleSwitch
            enabled={!!policy.backup_enabled}
            onChange={(v) => save({ backup_enabled: v })}
            disabled={saving}
          />

          <ScheduleForm
            time={(policy.backup_time || '02:00').slice(0, 5)}
            interval={policy.backup_interval || 'daily'}
            onSubmit={(time, interval) =>
              save({ backup_time: time, backup_interval: interval })
            }
            disabled={!policy.backup_enabled}
            saving={saving}
          />

          <RetentionSetting
            days={Number(policy.retention_days) || 90}
            onChange={(d) => setPolicy((p) => ({ ...p, retention_days: d }))}
            disabled={saving}
          />

          <div style={S.actions}>
            <button
              type="button"
              style={S.saveBtn}
              onClick={() => save({ retention_days: policy.retention_days })}
              disabled={saving}
            >
              {saving ? '저장 중…' : '보관 기간 저장'}
            </button>
          </div>
        </div>
      )}
    </JeepneyLayout>
  );
}

const S = {
  header: { marginBottom: spacing['2xl'] },
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
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
    maxWidth: '720px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    padding: `${spacing.sm} ${spacing.xl}`,
    background: colors.accentCyan,
    color: colors.bgPrimary,
    border: 'none',
    borderRadius: borderRadius.md,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    cursor: 'pointer',
    minHeight: '40px',
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
  okBox: {
    padding: spacing.lg,
    background: `${colors.success}20`,
    border: `1px solid ${colors.success}`,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  okText: {
    margin: 0,
    color: colors.success,
    fontSize: typography.sizes.sm,
  },
  center: {
    textAlign: 'center',
    padding: spacing['3xl'],
    color: colors.textSecondary,
  },
};
