'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Travel } from '@/types/travel';
import TabNavigation, { type TravelTab } from '@/components/travel/TabNavigation';
import TravelOverviewTab from '@/components/travel/TravelOverviewTab';
import TravelScheduleTab from '@/components/travel/TravelScheduleTab';
import TravelCostsTab from '@/components/travel/TravelCostsTab';
import TravelChecklistTab from '@/components/travel/TravelChecklistTab';
import TravelDocumentsTab from '@/components/travel/TravelDocumentsTab';
import TravelNotificationsTab from '@/components/travel/TravelNotificationsTab';
import TravelForm from '@/components/travel/TravelForm';

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

export default function TravelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const travelId = params?.id as string;

  const [travel, setTravel] = useState<Travel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TravelTab>('overview');
  const [showEditForm, setShowEditForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTravel = useCallback(async () => {
    if (!travelId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('로그인이 필요합니다.');
        return;
      }

      const res = await fetch(`/api/travels/${travelId}`, {
        method: 'GET',
        headers: {
          'x-user-id': session.user.id,
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      const body = await res.json();
      if (!res.ok || !body?.data) {
        throw new Error(body?.error || `요청 실패 (${res.status})`);
      }
      setTravel(body.data as Travel);
    } catch (e) {
      console.error('Failed to load travel:', e);
      setError(e instanceof Error ? e.message : '여행 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [travelId]);

  useEffect(() => {
    loadTravel();
  }, [loadTravel]);

  const handleSaved = (updated: Travel) => {
    setShowEditForm(false);
    setTravel(updated);
    loadTravel();
  };

  const handleDelete = async () => {
    if (!travel) return;
    if (!confirm(`"${travel.name}" 여행을 삭제하시겠습니까?\n삭제하면 모든 일정/비용/문서가 함께 삭제됩니다.`)) {
      return;
    }

    setDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        alert('로그인이 필요합니다.');
        return;
      }

      const res = await fetch(`/api/travels/${travel.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': session.user.id,
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `삭제 실패 (${res.status})`);
      }

      router.push('/travels');
    } catch (e) {
      console.error('Delete travel error:', e);
      alert(e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            불러오는 중...
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-700 font-medium mb-2">여행을 찾을 수 없습니다.</p>
            <p className="text-sm text-gray-500 mb-4">
              삭제되었거나 접근 권한이 없을 수 있습니다.
            </p>
            <Link
              href="/travels"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              ← 여행 목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !travel) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || '여행 정보를 불러오지 못했습니다.'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadTravel}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              다시 시도
            </button>
            <Link
              href="/travels"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const checklistItems =
    (travel as any).checklist || (travel as any).checklist_items || [];
  const costs = (travel as any).costs || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-3">
          <Link
            href="/travels"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            ← 여행 목록
          </Link>
        </div>

        <header className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 truncate">
                  {travel.name}
                </h1>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[travel.status]}`}
                >
                  {STATUS_LABEL[travel.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                {travel.location && <span>📍 {travel.location}</span>}
                <span>📅 {formatDateRange(travel.start_date, travel.end_date)}</span>
                <span>👥 {travel.members?.length ?? 0}명</span>
              </div>
              {travel.description && (
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">
                  {travel.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                수정
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

          <div className="p-4 sm:p-5">
            {activeTab === 'overview' && (
              <TravelOverviewTab travel={travel} onRefresh={loadTravel} />
            )}
            {activeTab === 'schedule' && (
              <TravelScheduleTab
                travelId={travel.id}
                events={travel.events || []}
                onRefresh={loadTravel}
              />
            )}
            {activeTab === 'costs' && (
              <TravelCostsTab
                travelId={travel.id}
                costs={costs}
                onRefresh={loadTravel}
              />
            )}
            {activeTab === 'checklist' && (
              <TravelChecklistTab
                travelId={travel.id}
                items={checklistItems}
                onRefresh={loadTravel}
              />
            )}
            {activeTab === 'documents' && (
              <TravelDocumentsTab
                travelId={travel.id}
                documents={travel.documents || []}
                onRefresh={loadTravel}
              />
            )}
            {activeTab === 'notifications' && (
              <TravelNotificationsTab
                travelId={travel.id}
                onRefresh={loadTravel}
              />
            )}
          </div>
        </div>
      </div>

      {showEditForm && (
        <TravelForm
          travel={travel}
          onClose={() => setShowEditForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
