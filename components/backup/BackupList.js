import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

function formatBytes(bytes) {
  if (bytes == null) return '—';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_VARIANT = {
  completed: 'success',
  in_progress: 'warning',
  pending: 'info',
  failed: 'error',
};
const STATUS_LABEL = {
  completed: '완료',
  in_progress: '진행중',
  pending: '대기',
  failed: '실패',
};

/**
 * BackupList — list of existing backups with per-row delete button.
 *
 * Props:
 *   backups: [{id, name, size_bytes, created_at, status}]
 *   onDelete: (backup) => void
 *   isLoading?: boolean
 *   pendingId?: string|null    show "삭제 중…" on that row
 */
export default function BackupList({
  backups = [],
  onDelete,
  isLoading = false,
  pendingId = null,
}) {
  // Sort by created_at DESC (latest first) — matches sort-order rule for event logs.
  const sorted = React.useMemo(() => {
    return [...backups].sort((a, b) => {
      const ta = new Date(a.created_at).getTime() || 0;
      const tb = new Date(b.created_at).getTime() || 0;
      return tb - ta;
    });
  }, [backups]);

  if (isLoading) {
    return <div style={S.empty}>로딩 중…</div>;
  }
  if (sorted.length === 0) {
    return <div style={S.empty}>백업이 없습니다.</div>;
  }

  return (
    <div style={S.wrap}>
      {/* Desktop table */}
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>이름</th>
            <th style={S.th}>크기</th>
            <th style={S.th}>생성일시</th>
            <th style={S.th}>상태</th>
            <th style={{ ...S.th, textAlign: 'right' }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => (
            <tr key={b.id} style={S.tr}>
              <td style={S.td}>
                <span style={S.name}>{b.name}</span>
              </td>
              <td style={S.td}>{formatBytes(b.size_bytes)}</td>
              <td style={S.td}>{formatDate(b.created_at)}</td>
              <td style={S.td}>
                <Badge
                  variant={STATUS_VARIANT[b.status] || 'secondary'}
                  size="sm"
                >
                  {STATUS_LABEL[b.status] || b.status}
                </Badge>
              </td>
              <td style={{ ...S.td, textAlign: 'right' }}>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete?.(b)}
                  disabled={pendingId === b.id}
                >
                  {pendingId === b.id ? '삭제 중…' : '삭제'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const S = {
  wrap: {
    width: '100%',
    overflowX: 'auto',
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '600px',
  },
  th: {
    textAlign: 'left',
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${colors.borderLight}`,
    background: colors.bgPrimary,
  },
  tr: {
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  td: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    verticalAlign: 'middle',
  },
  name: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  empty: {
    padding: spacing['3xl'],
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: typography.sizes.sm,
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
};
