import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import { colors, spacing, typography } from '../../../lib/design-tokens';
import { useAuth } from '../../../lib/use-auth';
import { supabase } from '../../../lib/supabase';

export default function BackupApp() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [sortOrder, setSortOrder] = useState('latest');

  // Fetch backups on mount
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/jeepney-personal/backup-app')}`);
      return;
    }
    fetchBackups();
  }, [user, authLoading, router]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('로그인이 필요합니다');

      const res = await fetch('/api/backup/list', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch backups');
      const { backups: data } = await res.json();
      setBackups(data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (order) => {
    setSortOrder(order);
    const sorted = [...backups].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return order === 'latest' ? timeB - timeA : timeA - timeB;
    });
    setBackups(sorted);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'success',
      in_progress: 'warning',
      pending: 'info',
      failed: 'error',
    };
    const labels = {
      completed: '완료',
      in_progress: '진행중',
      pending: '대기',
      failed: '실패',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} size="sm">
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <JeepneyLayout
      title="Backup Manager"
      level={3}
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'Backup App' },
      ]}
    >
      <section style={S.header}>
        <h2 style={S.title}>백업 관리</h2>
        <p style={S.subtitle}>Agent 상태 및 환경 설정 자동 백업</p>
      </section>

      <div style={S.controls}>
        <div style={S.sortControl}>
          <label style={S.label}>정렬:</label>
          <select
            value={sortOrder}
            onChange={(e) => handleSortChange(e.target.value)}
            style={S.select}
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
        </div>
        <Button variant="primary" size="md">
          새 백업 생성
        </Button>
      </div>

      {loading && (
        <div style={S.centerMessage}>
          <p>백업 목록 로딩 중...</p>
        </div>
      )}

      {error && (
        <div style={S.errorBox}>
          <p style={S.errorText}>오류: {error}</p>
        </div>
      )}

      {!loading && !error && backups.length === 0 && (
        <div style={S.emptyState}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.textTertiary}
            strokeWidth="1.5"
            style={{ marginBottom: spacing.md }}
          >
            <path d="M12 2v20m-9-9h18" />
          </svg>
          <p style={S.emptyTitle}>백업이 없습니다</p>
          <p style={S.emptyDesc}>백업을 생성하여 시작하세요.</p>
        </div>
      )}

      {!loading && !error && backups.length > 0 && (
        <div style={S.grid}>
          {backups.map((backup) => (
            <div
              key={backup.id}
              style={S.cardWrapper}
              onClick={() => setSelectedBackup(backup)}
            >
              <Card hoverable>
                <div style={S.cardContent}>
                  <div style={S.cardHeader}>
                    <div>
                      <h3 style={S.backupName}>{backup.name}</h3>
                      <p style={S.backupDate}>{formatDate(backup.created_at)}</p>
                    </div>
                    {getStatusBadge(backup.status)}
                  </div>

                  <div style={S.cardMeta}>
                    <div style={S.metaItem}>
                      <span style={S.metaLabel}>크기:</span>
                      <span style={S.metaValue}>{formatSize(backup.size_bytes)}</span>
                    </div>
                    <div style={S.metaItem}>
                      <span style={S.metaLabel}>파일:</span>
                      <span style={S.metaValue}>{backup.file_count || 0}개</span>
                    </div>
                    <div style={S.metaItem}>
                      <span style={S.metaLabel}>타입:</span>
                      <span style={S.metaValue}>{backup.backup_type}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <BackupDetailModal
        backup={selectedBackup}
        onClose={() => setSelectedBackup(null)}
        onRefresh={fetchBackups}
      />
    </JeepneyLayout>
  );
}

function BackupDetailModal({ backup, onClose, onRefresh }) {
  if (!backup) return null;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Modal
      isOpen={!!backup}
      onClose={onClose}
      title={backup.name}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            닫기
          </Button>
          <Button variant="primary" size="md" disabled>
            다운로드
          </Button>
        </>
      }
    >
      <div style={S.modalContent}>
        <div style={S.section}>
          <h4 style={S.sectionTitle}>메타데이터</h4>
          <table style={S.metaTable}>
            <tbody>
              <tr style={S.metaRow}>
                <td style={S.metaKey}>생성일시:</td>
                <td style={S.metaValue}>{formatDate(backup.created_at)}</td>
              </tr>
              <tr style={S.metaRow}>
                <td style={S.metaKey}>백업 타입:</td>
                <td style={S.metaValue}>{backup.backup_type}</td>
              </tr>
              <tr style={S.metaRow}>
                <td style={S.metaKey}>상태:</td>
                <td style={S.metaValue}>{backup.status}</td>
              </tr>
              <tr style={S.metaRow}>
                <td style={S.metaKey}>크기:</td>
                <td style={S.metaValue}>{formatSize(backup.size_bytes)}</td>
              </tr>
              <tr style={S.metaRow}>
                <td style={S.metaKey}>파일 수:</td>
                <td style={S.metaValue}>{backup.file_count || 0}개</td>
              </tr>
            </tbody>
          </table>
        </div>

        {backup.notes && (
          <div style={S.section}>
            <h4 style={S.sectionTitle}>메모</h4>
            <p style={S.notesText}>{backup.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

const S = {
  header: {
    marginBottom: spacing['3xl'],
  },
  title: {
    margin: 0,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    margin: `${spacing.md} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
    flexWrap: 'wrap',
  },
  sortControl: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  select: {
    padding: `${spacing.xs} ${spacing.md}`,
    fontSize: typography.sizes.sm,
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: '4px',
    cursor: 'pointer',
  },
  centerMessage: {
    textAlign: 'center',
    padding: spacing['4xl'],
    color: colors.textSecondary,
  },
  errorBox: {
    padding: spacing.lg,
    backgroundColor: `${colors.error}20`,
    border: `1px solid ${colors.error}`,
    borderRadius: '8px',
    marginBottom: spacing.lg,
  },
  errorText: {
    margin: 0,
    color: colors.error,
    fontSize: typography.sizes.sm,
  },
  emptyState: {
    textAlign: 'center',
    padding: spacing['4xl'],
    color: colors.textTertiary,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    margin: 0,
  },
  emptyDesc: {
    fontSize: typography.sizes.sm,
    margin: `${spacing.sm} 0 0`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: spacing.lg,
  },
  cardWrapper: {
    cursor: 'pointer',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  backupName: {
    margin: 0,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  backupDate: {
    margin: `${spacing.xs} 0 0`,
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  cardMeta: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTop: `1px solid ${colors.borderLight}`,
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  metaLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  metaValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  modalContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['2xl'],
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  sectionTitle: {
    margin: 0,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  metaTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  metaRow: {
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  metaKey: {
    padding: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
    fontWeight: typography.weights.medium,
    textAlign: 'left',
    width: '40%',
  },
  metaValue: {
    padding: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  notesText: {
    margin: 0,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.relaxed,
  },
};
