import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import {
  QuotaCard,
  BackupList,
  DeleteConfirmDialog,
  StorageWarningBanner,
} from '../../../components/backup';
import { colors, spacing, typography, borderRadius } from '../../../lib/design-tokens';
import { useAuth } from '../../../lib/use-auth';
import { apiGet, apiPost } from '../../../lib/backup-fetch';

export default function StorageManagement() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [quota, setQuota] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, l] = await Promise.all([
        apiGet('/api/backup/quota/status'),
        apiGet('/api/backup/list'),
      ]);
      setQuota(q);
      setBackups(l.backups || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/jeepney-personal/backup-app/storage')}`);
      return;
    }
    refresh();
  }, [user, authLoading, refresh, router]);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setPendingId(confirmTarget.id);
    try {
      await apiPost('/api/backup/cleanup/manual', { backup_id: confirmTarget.id });
      setConfirmTarget(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <JeepneyLayout
      title="저장소 관리"
      level={4}
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'Backup App', href: '/jeepney-personal/backup-app' },
        { label: '저장소' },
      ]}
    >
      <section style={S.header}>
        <h2 style={S.title}>저장소 관리</h2>
        <p style={S.subtitle}>현재 사용량과 백업 목록을 확인합니다.</p>
      </section>

      {error && (
        <div style={S.errBox}>
          <p style={S.errText}>오류: {error}</p>
        </div>
      )}

      {quota && (
        <div style={{ marginBottom: spacing.lg }}>
          <StorageWarningBanner
            usage_percent={quota.usage_percent}
            threshold={quota.warning_threshold_percent || 80}
            manageHref="/jeepney-personal/backup-app/storage"
          />
        </div>
      )}

      {loading ? (
        <div style={S.center}>로딩 중…</div>
      ) : (
        <div style={S.stack}>
          {quota && (
            <QuotaCard
              max_bytes={quota.max_storage_bytes}
              current_bytes={quota.current_usage_bytes}
              warning_threshold={quota.warning_threshold_percent || 80}
              plan_type={quota.plan_type}
            />
          )}

          <div>
            <h3 style={S.sectionTitle}>백업 목록</h3>
            {backups.length === 0 ? (
              <div style={S.emptyState}>
                <p style={S.emptyStateText}>저장된 백업이 없습니다.</p>
                <p style={S.emptyStateHint}>자동 백업 설정에서 백업 일정을 활성화하세요.</p>
              </div>
            ) : (
              <BackupList
                backups={backups}
                onDelete={setConfirmTarget}
                pendingId={pendingId}
              />
            )}
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={!!confirmTarget}
        backup_name={confirmTarget?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => (pendingId ? null : setConfirmTarget(null))}
        busy={!!pendingId}
      />
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
    gap: spacing['2xl'],
  },
  sectionTitle: {
    margin: `0 0 ${spacing.md}`,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
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
