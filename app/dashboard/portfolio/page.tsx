'use client';

// Team Dashboard P2 — Portfolio (App Router)
// Mirrors /pages/dashboard/portfolio.js behavior using Tailwind, matching
// the styling conventions in /app/dashboard/team-status/page.tsx.
//
// Data: GET/POST /api/dashboard/portfolio, PUT/DELETE /api/dashboard/portfolio/[id]
// Auth: lib/use-auth.js (real Supabase user; never hardcode user IDs)

import { useCallback, useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
// useAuth is plain JS — typed loosely to keep tsconfig happy
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { useAuth } from '@/lib/use-auth';

type PortfolioStatus = 'in_progress' | 'completed' | 'on_hold' | 'planned';

interface PortfolioItem {
  id: string;
  member_id: string | null;
  project_name: string;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  skills_used: string[] | null;
  status: PortfolioStatus;
  created_at?: string;
  updated_at?: string;
}

const STATUS_FILTERS: { value: 'all' | PortfolioStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'on_hold', label: '보류' },
  { value: 'planned', label: '계획' },
];

const STATUS_LABEL: Record<PortfolioStatus, string> = {
  in_progress: '진행중',
  completed: '완료',
  on_hold: '보류',
  planned: '계획',
};

const STATUS_BADGE: Record<PortfolioStatus, string> = {
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  on_hold: 'bg-amber-100 text-amber-800 border-amber-200',
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PortfolioDashboardPage() {
  const { user, isAuthed, loading: authLoading } = useAuth() as {
    user: { id: string; email?: string } | null;
    isAuthed: boolean;
    loading: boolean;
  };
  const userId = user?.id || null;

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | PortfolioStatus>('all');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
      const r = await fetch(`/api/dashboard/portfolio${qs}`, {
        headers: await authHeader(),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setItems((j.items || []) as PortfolioItem[]);
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
      if (!confirm('이 포트폴리오를 삭제하시겠습니까?')) return;
      try {
        const r = await fetch(`/api/dashboard/portfolio/${id}`, {
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
            href={`/login?next=${encodeURIComponent('/dashboard/portfolio')}`}
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
                href="/dashboard/milestones"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← 마일스톤
              </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">포트폴리오</h1>
            <p className="text-slate-600 text-sm mt-1">개인/팀 프로젝트 포트폴리오 관리</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm shadow-sm min-h-[44px]"
          >
            + 새 포트폴리오
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

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">로딩 중…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200 text-slate-500">
            포트폴리오가 없습니다. 우상단 [+ 새 포트폴리오]를 눌러 등록하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <PortfolioCard
                key={it.id}
                item={it}
                isOwner={!!userId && userId === it.member_id}
                onEdit={() => {
                  setEditing(it);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(it.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-slate-500 text-xs">
          {!loading && `${items.length}건 표시 중`}
        </div>
      </div>

      {showForm && (
        <PortfolioFormModal
          initial={editing}
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

function PortfolioCard({
  item,
  isOwner,
  onEdit,
  onDelete,
}: {
  item: PortfolioItem;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badgeClass = STATUS_BADGE[item.status] || STATUS_BADGE.planned;
  const period =
    [item.start_date, item.end_date].filter(Boolean).join(' ~ ') || '기간 미지정';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 truncate">{item.project_name}</h3>
          {item.role && <p className="text-xs text-slate-500 mt-0.5">{item.role}</p>}
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${badgeClass}`}
        >
          {STATUS_LABEL[item.status] || item.status}
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-2">{period}</p>

      {item.description && (
        <p className="text-sm text-slate-700 mb-3 line-clamp-3">{item.description}</p>
      )}

      {Array.isArray(item.skills_used) && item.skills_used.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {item.skills_used.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 min-h-[36px]"
          >
            편집
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 px-3 py-2 text-sm font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 min-h-[36px]"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

function PortfolioFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: PortfolioItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [projectName, setProjectName] = useState(initial?.project_name || '');
  const [role, setRole] = useState(initial?.role || '');
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [skillsText, setSkillsText] = useState(
    Array.isArray(initial?.skills_used) ? (initial?.skills_used as string[]).join(', ') : ''
  );
  const [statusVal, setStatusVal] = useState<PortfolioStatus>(initial?.status || 'in_progress');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setErr('프로젝트명을 입력하세요.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const skills_used = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        project_name: projectName.trim(),
        role: role.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
        skills_used: skills_used.length ? skills_used : null,
        status: statusVal,
      };
      const url = isEdit
        ? `/api/dashboard/portfolio/${initial!.id}`
        : '/api/dashboard/portfolio';
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
            {isEdit ? '포트폴리오 편집' : '포트폴리오 추가'}
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
          <Field label="프로젝트명 *">
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
          </Field>
          <Field label="역할">
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="예: PM, Lead Dev"
            />
          </Field>
          <div className="flex gap-3">
            <Field label="시작일" className="flex-1">
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="종료일" className="flex-1">
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="상태">
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value as PortfolioStatus)}
            >
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
              <option value="on_hold">보류</option>
              <option value="planned">계획</option>
            </select>
          </Field>
          <Field label="설명">
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="스킬 (쉼표로 구분)">
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="예: React, Supabase, PostgreSQL"
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
