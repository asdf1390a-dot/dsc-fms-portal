// Backup Phase 2 — primary dashboard page.
// Lists backups for the current user with filtering (status/search/date) and
// supports create + delete via the existing API endpoints. Also surfaces the
// quota status and 30-day metrics summary at the top.
//
// Auth: redirects to /login when unauthenticated. All API calls send the
// Supabase access token as Bearer.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import {
  BackupList,
  DeleteConfirmDialog,
  QuotaCard,
  MetricsSummary,
  StorageWarningBanner,
} from '../../components/backup';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

const STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'completed', label: '완료' },
  { value: 'in_progress', label: '진행중' },
  { value: 'pending', label: '대기' },
  { value: 'failed', label: '실패' },
];

const BACKUP_TYPES = [
  { value: 'agent_state', label: 'Agent State' },
  { value: 'memory_snapshot', label: 'Memory Snapshot' },
  { value: 'full', label: 'Full' },
  { value: 'incremental', label: 'Incremental' },
];

async function authedFetch(url, opts = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...opts, headers });
}

export default function BackupDashboard() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();

  const [backups, setBackups] = useState([]);
  const [quota, setQuota] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters synced to query params
  const qStatus = typeof router.query.status === 'string' ? router.query.status : '';
  const qSearch = typeof router.query.q === 'string' ? router.query.q : '';
  const qFrom = typeof router.query.from === 'string' ? router.query.from : '';
  const qTo = typeof router.query.to === 'string' ? router.query.to : '';

  const [searchDraft, setSearchDraft] = useState(qSearch);
  useEffect(() => { setSearchDraft(qSearch); }, [qSearch]);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('agent_state');
  const [createNotes, setCreateNotes] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // auth guard
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/backup')}`);
    }
  }, [authLoading, isAuthed, router]);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [listRes, quotaRes, metricsRes] = await Promise.all([
        authedFetch('/api/backup/list'),
        authedFetch('/api/backup/quota/status'),
        authedFetch('/api/backup/metrics/summary'),
      ]);
      const listJson = await listRes.json().catch(() => ({}));
      if (!listRes.ok) throw new Error(listJson.error || `list HTTP ${listRes.status}`);
      setBackups(listJson.backups || []);

      if (quotaRes.ok) {
        const qj = await quotaRes.json().catch(() => ({}));
        setQuota(qj);
      }
      if (metricsRes.ok) {
        const mj = await metricsRes.json().catch(() => ({}));
        setMetrics(mj);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) loadAll();
  }, [isAuthed, loadAll]);

  // client-side filtering (the list API doesn't yet accept filters).
  const filtered = useMemo(() => {
    const fromTs = qFrom ? new Date(qFrom).getTime() : null;
    const toTs = qTo ? new Date(qTo).getTime() + 24 * 3600 * 1000 - 1 : null;
    const needle = qSearch.trim().toLowerCase();
    return backups.filter((b) => {
      if (qStatus && b.status !== qStatus) return false;
      if (needle && !(b.name || '').toLowerCase().includes(needle)) return false;
      const ts = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      return true;
    });
  }, [backups, qStatus, qSearch, qFrom, qTo]);

  const updateQuery = (patch) => {
    const next = { ...router.query, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === '' || next[k] == null) delete next[k];
    });
    router.replace({ pathname: '/backup', query: next }, undefined, { shallow: true });
  };

  const onSubmitSearch = (e) => {
    e.preventDefault();
    updateQuery({ q: searchDraft.trim() });
  };

  const onCreate = async () => {
    if (!createName.trim()) return;
    setCreateBusy(true);
    try {
      const res = await authedFetch('/api/backup/create', {
        method: 'POST',
        body: JSON.stringify({
          name: createName.trim(),
          backup_type: createType,
          notes: createNotes.trim() || null,
          status: 'pending',
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setShowCreate(false);
      setCreateName('');
      setCreateNotes('');
      setCreateType('agent_state');
      await loadAll();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await authedFetch(`/api/backup/${deleteTarget.id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setDeleteTarget(null);
      await loadAll();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (authLoading || !isAuthed) {
    return (
      <div style={S.page}>
        <p style={S.muted}>로딩 중…</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>백업 관리 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <div>
            <h1 style={S.h1}>백업 관리</h1>
            <p style={S.subtle}>Backup Phase 2 — list / filter / create / delete</p>
          </div>
          <div style={S.headerActions}>
            <Link href="/" legacyBehavior>
              <a style={S.link}>← 대시보드</a>
            </Link>
            <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
              + 새 백업
            </Button>
          </div>
        </header>

        {quota?.warning && (
          <div style={S.bannerWrap}>
            <StorageWarningBanner
              usage_percent={quota.usage_percent}
              exceeded={quota.exceeded}
              warning_threshold={quota.warning_threshold_percent}
            />
          </div>
        )}

        <section style={S.grid}>
          {quota && (
            <QuotaCard
              max_bytes={quota.max_storage_bytes}
              current_bytes={quota.current_usage_bytes}
              warning_threshold={quota.warning_threshold_percent}
              plan_type={quota.plan_type}
            />
          )}
          {metrics && <MetricsSummary metrics={metrics} />}
        </section>

        <section style={S.filterCard}>
          <form onSubmit={onSubmitSearch} style={S.filterRow}>
            <div style={S.searchWrap}>
              <Input
                placeholder="이름 검색…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </div>
            <select
              style={S.select}
              value={qStatus}
              onChange={(e) => updateQuery({ status: e.target.value })}
              aria-label="상태 필터"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="date"
              style={S.dateInput}
              value={qFrom}
              onChange={(e) => updateQuery({ from: e.target.value })}
              aria-label="시작일"
            />
            <input
              type="date"
              style={S.dateInput}
              value={qTo}
              onChange={(e) => updateQuery({ to: e.target.value })}
              aria-label="종료일"
            />
            <Button type="submit" variant="secondary" size="md">검색</Button>
            {(qStatus || qSearch || qFrom || qTo) && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.replace('/backup', undefined, { shallow: true })}
              >
                초기화
              </Button>
            )}
          </form>
          <p style={S.count} aria-live="polite">
            {filtered.length}개 / 전체 {backups.length}개
          </p>
        </section>

        {error && (
          <div role="alert" style={S.error}>{error}</div>
        )}

        <section>
          <BackupList
            backups={filtered}
            isLoading={loading}
            pendingId={deleteBusy ? deleteTarget?.id : null}
            onDelete={(b) => setDeleteTarget(b)}
          />
        </section>
      </main>

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={createBusy ? undefined : () => setShowCreate(false)}
        title="새 백업 생성"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setShowCreate(false)} disabled={createBusy}>
              취소
            </Button>
            <Button variant="primary" size="md" onClick={onCreate} disabled={createBusy || !createName.trim()}>
              {createBusy ? '생성 중…' : '생성'}
            </Button>
          </>
        }
      >
        <div style={S.formStack}>
          <Input
            label="이름"
            required
            placeholder="예: agent-state-2026-05-29"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <label style={S.label}>
            유형
            <select
              style={S.select}
              value={createType}
              onChange={(e) => setCreateType(e.target.value)}
            >
              {BACKUP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label style={S.label}>
            메모 (선택)
            <textarea
              style={S.textarea}
              rows={3}
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="추가 설명…"
            />
          </label>
        </div>
      </Modal>

      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        backup_name={deleteTarget?.name}
        onConfirm={onConfirmDelete}
        onCancel={() => (deleteBusy ? null : setDeleteTarget(null))}
        busy={deleteBusy}
      />
    </>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: colors.bgPrimary,
    color: colors.textPrimary,
    padding: spacing.lg,
    maxWidth: 1200,
    margin: '0 auto',
    fontFamily: typography.fonts.body,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  h1: {
    margin: 0,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtle: {
    margin: `${spacing.xs} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  headerActions: {
    display: 'flex',
    gap: spacing.sm,
    alignItems: 'center',
  },
  link: {
    color: colors.accentCyan,
    fontSize: typography.sizes.sm,
    textDecoration: 'none',
  },
  bannerWrap: {
    marginBottom: spacing.lg,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  filterCard: {
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchWrap: {
    flex: '1 1 220px',
    minWidth: 200,
  },
  select: {
    minHeight: 44,
    fontSize: 16,
    padding: `${spacing.sm} ${spacing.md}`,
    background: colors.bgPrimary,
    color: colors.textPrimary,
    border: `2px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    outline: 'none',
  },
  dateInput: {
    minHeight: 44,
    fontSize: 16,
    padding: `${spacing.sm} ${spacing.md}`,
    background: colors.bgPrimary,
    color: colors.textPrimary,
    border: `2px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    outline: 'none',
  },
  count: {
    margin: `${spacing.md} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  error: {
    background: 'rgba(239,68,68,0.12)',
    border: `1px solid ${colors.error}`,
    color: colors.error,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    fontSize: typography.sizes.sm,
  },
  muted: {
    color: colors.textTertiary,
    fontSize: typography.sizes.sm,
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  textarea: {
    width: '100%',
    minHeight: 80,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: 16,
    fontFamily: typography.fonts.body,
    background: colors.bgPrimary,
    color: colors.textPrimary,
    border: `2px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    resize: 'vertical',
    outline: 'none',
  },
};
