import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import {
  NotificationPreferences,
  NotificationList,
  NotificationTypeFilter,
} from '../../../components/backup';
import { colors, spacing, typography, borderRadius } from '../../../lib/design-tokens';
import { useAuth } from '../../../lib/use-auth';
import { apiGet, apiPost } from '../../../lib/backup-fetch';

// Channel prefs are stored locally for now (no policy field yet on Phase 2 server).
const PREFS_KEY = 'backup.notification.channels';
const DEFAULT_CHANNELS = ['in_app'];

function loadPrefs() {
  if (typeof window === 'undefined') return DEFAULT_CHANNELS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_CHANNELS;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : DEFAULT_CHANNELS;
  } catch {
    return DEFAULT_CHANNELS;
  }
}

function savePrefs(arr) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(arr));
  } catch {}
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [typeFilter, setTypeFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    setChannels(loadPrefs());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (typeFilter) qs.set('type', typeFilter);
      if (unreadOnly) qs.set('unread', '1');
      qs.set('limit', '50');
      const data = await apiGet(`/api/backup/notifications/list?${qs.toString()}`);
      setItems(data.notifications || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, unreadOnly]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/jeepney-personal/backup-app/notifications')}`);
      return;
    }
    refresh();
  }, [user, authLoading, refresh, router]);

  const handleChannelsChange = (next) => {
    if (!Array.isArray(next) || next.length === 0) {
      setError('최소 1개의 알림 채널이 필요합니다');
      return;
    }
    setChannels(next);
    savePrefs(next);
    setError(null);
  };

  const handleMarkRead = async (n) => {
    setPendingId(n.id);
    try {
      await apiPost(`/api/backup/notifications/${n.id}/read`, {});
      setItems((prev) =>
        prev.map((it) =>
          it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it,
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <JeepneyLayout
      title="알림 설정 & 히스토리"
      level={4}
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'Backup App', href: '/jeepney-personal/backup-app' },
        { label: '알림' },
      ]}
    >
      <section style={S.header}>
        <h2 style={S.title}>알림 설정 & 히스토리</h2>
        <p style={S.subtitle}>
          채널 환경설정과 최근 알림을 확인합니다.
        </p>
      </section>

      {error && (
        <div style={S.errBox}>
          <p style={S.errText}>오류: {error}</p>
        </div>
      )}

      <div style={S.stack}>
        <NotificationPreferences
          value={channels}
          onChange={handleChannelsChange}
        />

        <NotificationTypeFilter
          type={typeFilter}
          onTypeChange={setTypeFilter}
          unreadOnly={unreadOnly}
          onUnreadChange={setUnreadOnly}
        />

        <div>
          <h3 style={S.sectionTitle}>최근 알림</h3>
          <NotificationList
            notifications={items}
            onMarkRead={handleMarkRead}
            isLoading={loading}
            pendingId={pendingId}
          />
        </div>
      </div>
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
};
