'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Travel } from '@/types/travel';
import TravelForm from '@/components/travel/TravelForm';

type StatusFilter = 'all' | 'upcoming' | 'ongoing' | 'completed';
type SortBy = 'date' | 'name' | 'cost';

const STATUS_LABEL: Record<Travel['status'], string> = {
  upcoming: '예정',
  ongoing: '진행중',
  completed: '완료',
};

const STATUS_BADGE: Record<Travel['status'], string> = {
  upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
  ongoing: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
};

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDateRange(start: string, end: string): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (!s && !e) return '';
  if (s === e) return s;
  return `${s} ~ ${e}`;
}

function memberCount(t: Travel): number {
  return t.members?.length ?? 0;
}

export default function TravelListPage() {
  const [travels, setTravels] = useState<Travel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [showForm, setShowForm] = useState(false);
  const [editingTravel, setEditingTravel] = useState<Travel | null>(null);

  const loadTravels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('로그인이 필요합니다.');
        setTravels([]);
        return;
      }

      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      qs.set('sort_by', sortBy);
      qs.set('scope', 'involved');

      const res = await fetch(`/api/travels?${qs.toString()}`, {
        method: 'GET',
        headers: {
          'x-user-id': session.user.id,
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || `요청 실패 (${res.status})`);
      }
      setTravels((body?.data || []) as Travel[]);
    } catch (e) {
      console.error('Failed to load travels:', e);
      setError(e instanceof Error ? e.message : '여행 목록을 불러오지 못했습니다.');
      setTravels([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortBy]);

  useEffect(() => {
    loadTravels();
  }, [loadTravels]);

  const handleSaved = () => {
    setShowForm(false);
    setEditingTravel(null);
    loadTravels();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">여행 관리</h1>
            <p className="text-sm text-gray-600 mt-1">
              출장·여행 일정과 비용을 한곳에서 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingTravel(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>새 여행</span>
          </button>
        </header>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              상태
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="upcoming">예정</option>
              <option value="ongoing">진행중</option>
              <option value="completed">완료</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              정렬
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="date">날짜순</option>
              <option value="name">이름순</option>
              <option value="cost">비용순</option>
            </select>
          </div>
          <div className="ml-auto text-sm text-gray-500">
            총 <span className="font-semibold text-gray-800">{travels.length}</span>건
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            불러오는 중...
          </div>
        ) : travels.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-700 font-medium mb-1">아직 등록된 여행이 없습니다.</p>
            <p className="text-sm text-gray-500 mb-4">
              새 여행을 등록해 일정과 비용을 관리해 보세요.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingTravel(null);
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 새 여행 만들기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {travels.map((t) => (
              <Link
                key={t.id}
                href={`/travels/${t.id}`}
                className="block bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {t.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}
                  >
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                {t.location && (
                  <p className="text-sm text-gray-600 mb-1 truncate">
                    📍 {t.location}
                  </p>
                )}
                <p className="text-sm text-gray-600 mb-2">
                  📅 {formatDateRange(t.start_date, t.end_date)}
                </p>
                {t.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                    {t.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span>👥 {memberCount(t)}명</span>
                  <span>📌 {t.events?.length ?? 0}건</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <TravelForm
          travel={editingTravel}
          onClose={() => {
            setShowForm(false);
            setEditingTravel(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
