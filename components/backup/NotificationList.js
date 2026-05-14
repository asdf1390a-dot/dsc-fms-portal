import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const TYPE_LABEL = {
  success: '성공',
  failure: '실패',
  quota_warning: '할당량 경고',
  quota_exceeded: '할당량 초과',
  deletion_scheduled: '삭제 예정',
};

const TYPE_VARIANT = {
  success: 'success',
  failure: 'error',
  quota_warning: 'warning',
  quota_exceeded: 'error',
  deletion_scheduled: 'info',
};

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

/**
 * NotificationList — sorted-desc list of backup notifications.
 *
 * Props:
 *   notifications: [{id, notification_type, message, sent_at, read_at, created_at}]
 *   onMarkRead: (notification) => void
 *   isLoading?: bool
 *   pendingId?: string|null
 */
export default function NotificationList({
  notifications = [],
  onMarkRead,
  isLoading = false,
  pendingId = null,
}) {
  if (isLoading) {
    return <div style={S.empty}>로딩 중…</div>;
  }
  if (notifications.length === 0) {
    return <div style={S.empty}>알림이 없습니다.</div>;
  }

  return (
    <ul style={S.list}>
      {notifications.map((n) => {
        const unread = !n.read_at;
        return (
          <li
            key={n.id}
            style={{
              ...S.item,
              background: unread ? `${colors.accentCyan}10` : colors.bgSecondary,
              borderLeft: unread
                ? `3px solid ${colors.accentCyan}`
                : `3px solid transparent`,
            }}
          >
            <div style={S.itemHead}>
              <Badge
                variant={TYPE_VARIANT[n.notification_type] || 'secondary'}
                size="sm"
              >
                {TYPE_LABEL[n.notification_type] || n.notification_type}
              </Badge>
              <span style={S.time}>
                {formatDate(n.sent_at || n.created_at)}
              </span>
            </div>
            <p style={S.msg}>{n.message}</p>
            <div style={S.itemFoot}>
              {n.notification_channel && (
                <span style={S.channel}>via {n.notification_channel}</span>
              )}
              {unread && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMarkRead?.(n)}
                  disabled={pendingId === n.id}
                >
                  {pendingId === n.id ? '처리 중…' : '읽음'}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const S = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    padding: spacing.lg,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
  itemHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  time: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  msg: {
    margin: 0,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.normal,
  },
  itemFoot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  channel: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
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
