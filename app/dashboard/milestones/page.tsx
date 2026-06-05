'use client';

// Team Dashboard P2 — Milestones (App Router)
// Mirrors /pages/dashboard/milestones.js using Tailwind, matching
// styling conventions in /app/dashboard/team-status/page.tsx.
//
// Data: GET/POST /api/dashboard/milestones, PUT/DELETE /api/dashboard/milestones/[id]
// Auth: lib/use-auth.js (real Supabase user; never hardcode user IDs)

import { useCallback, useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/use-auth';

type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

interface Milestone {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  target_date: string;
  status: MilestoneStatus;
  owner_id: string | null;
  completion_date: string | null;
  created_at?: string;
  updated_at?: string;
}

const STATUS_FILTERS: { value: 'all' | MilestoneStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'blocked', label: '차단' },
];

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending: '대기',
  in_progress: '진행중',
  completed: '완료',
  blocked: '차단',
};

const STATUS_BADGE: Record<MilestoneStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  blocked: 'bg-red-100 text-red-800 border-red-200',
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isOverdue(target: string | null, status: MilestoneStatus): boolean {
  if (!target || status === 'completed') return false;
  return new Date(target) < new Date(new Date().toDateString());
}

export default function MilestonesDashboardPage() {
  const { user, isAuthed, loading: authLoading } = useAuth() as {
    user: { id: string; email?: string } | null;
    isAuthed: boolean;
    loading: boolean;
  };
  const userId = user?.id || null;

  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | MilestoneStatus>('all');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
      const r = await fetch(`/api/dashboard/milestones${qs}`, {
        headers: await authHeader(),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setItems((j.items || []) as Milestone[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (!authLoading && isAuthed) load();
  }, [authLoading, isAuthed, load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('이 마일스톤을 삭제하시겠습니까?')) return;
      try {
        const r = await fetch(`/api/dashboard/milestones/${id}`, {
          method: 'DELETE',
          headers: await authHeader(),
        });
        if (!r.ok && r.status !== 204) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${r.status}`);
        }
        load();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [load]
  );

  const handleComplete = useCallback(
    async (id: string) => {
      try {
        const r = await fetch(`/api/dashboard/milestones/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body: JSON.stringify({
            status: 'completed',
            completion_date: new Date().toISOString().slice(0, 10),
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        load();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [load]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">로딩 중…</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-700 mb-3">로그인이 필요합니다.</p>
          <Link
            href={`/login?next=${encodeURIComponent('/dashboard/milestones')}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
          >
            로그인
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard/portfolio"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← 포트폴리오
              </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">마일스톤</h1>
            <p className="text-slate-600 text-sm mt-1">프로젝트 마일스톤 진척 관리</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm shadow-sm min-h-[44px]"
          >
            + 새 마일스톤
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto mb-6 pb-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap min-h-[36px] border transition ${
                status === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">로딩 중…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200 text-slate-500">
            마일스톤이 없습니다. 우상단 [+ 새 마일스톤]을 눌러 등록하세요.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">제목</th>
                    <th className="px-4 py-3 text-left font-semibold w-28">목표일</th>
                    <th className="px-4 py-3 text-left font-semibold w-40">소유자</th>
                    <th className="px-4 py-3 text-left font-semibold w-24">상태</th>
                    <th className="px-4 py-3 text-left font-semibold w-44">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => {
                    const badge = STATUS_BADGE[m.status] || STATUS_BADGE.pending;
                    const overdue = isOverdue(m.target_date, m.status);
                    const isOwner = !!userId && m.owner_id === userId;
                    return (
                      <tr
                        key={m.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{m.title}</div>
                          {m.description && (
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {m.description}
                            </div>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 ${
                            overdue ? 'text-red-600 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          {m.target_date || '-'}
                          {overdue && (
                            <div className="inline-block ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 rounded">
                              지연
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {m.owner_id ? (
                            <span
                              className="font-mono text-xs"
                              title={m.owner_id}
                            >
                              {m.owner_id.slice(0, 8)}…
                              {isOwner && (
                                <span className="ml-1 px-1 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200 rounded">
                                  나
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${badge}`}
                          >
                            {STATUS_LABEL[m.status] || m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isOwner ? (
                            <div className="flex gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(m);
                                  setShowForm(true);
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                              >
                                편집
                              </button>
                              {m.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => handleComplete(m.id)}
                                  className="px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded hover:bg-green-100"
                                >
                                  완료
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(m.id)}
                                className="px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100"
                              >
                                삭제
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">읽기전용</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-slate-500 text-xs">
          {!loading && `${items.length}건 표시 중`}
        </div>
      </div>

      {showForm && (
        <MilestoneFormModal
          initial={editing}
          defaultOwner={userId}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MilestoneFormModal({
  initial,
  defaultOwner,
  onClose,
  onSaved,
}: {
  initial: Milestone | null;
  defaultOwner: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [projectId, setProjectId] = useState(initial?.project_id || '');
  const [targetDate, setTargetDate] = useState(initial?.target_date || '');
  const [statusVal, setStatusVal] = useState<MilestoneStatus>(initial?.status || 'pending');
  const [ownerId, setOwnerId] = useState(initial?.owner_id || defaultOwner || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErr('제목을 입력하세요.');
      return;
    }
    if (!targetDate) {
      setErr('목표일을 선택하세요.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId.trim() || null,
        target_date: targetDate,
        status: statusVal,
        owner_id: ownerId.trim() || null,
      };
      const url = isEdit
        ? `/api/dashboard/milestones/${initial!.id}`
        : '/api/dashboard/milestones';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? '마일스톤 편집' : '마일스톤 추가'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl w-11 h-11 flex items-center justify-center"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="제목 *">
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
          <Field label="설명">
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="프로젝트 ID (선택)">
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="portfolio_items.id (UUID)"
            />
          </Field>
          <Field label="목표일 *">
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
            />
          </Field>
          <Field label="상태">
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value as MilestoneStatus)}
            >
              <option value="pending">대기</option>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
              <option value="blocked">차단</option>
            </select>
          </Field>
          <Field label="소유자 ID">
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="auth.user.id (UUID) — 기본값: 현재 로그인 사용자"
            />
          </Field>

          {err && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-60 min-h-[44px]"
          >
            {saving ? '저장 중…' : isEdit ? '저장' : '추가'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded hover:bg-slate-200 min-h-[44px]"
          >
            취소
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
