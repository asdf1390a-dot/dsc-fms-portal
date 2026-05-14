'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTravelsList } from '@/hooks/useTravelData';
import TravelCard from '@/components/travels/TravelCard';
import { Travel } from '@/types/travel';

export default function TravelListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'cost' | 'name'>('date');

  const { travels, loading, error, refetch } = useTravelsList(
    statusFilter === 'all' ? undefined : statusFilter,
    sortBy
  );

  const filteredTravels = useMemo(() => {
    let result = [...travels];

    if (sortBy === 'cost') {
      result.sort((a, b) => {
        const aCost = a.costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
        const bCost = b.costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
        return bCost - aCost;
      });
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [travels, sortBy]);

  const handleDelete = useCallback(
    async (travelId: string) => {
      if (!confirm('이 여행을 삭제하시겠습니까?')) return;

      try {
        const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/travels/${travelId}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': session.user.id,
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('여행 삭제 실패');
        }

        refetch();
      } catch (err) {
        alert(err instanceof Error ? err.message : '여행 삭제 중 오류 발생');
      }
    },
    [refetch]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">여행 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">나의 여행</h1>
            <button
              onClick={() => router.push('/travel/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              새 여행 생성
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'upcoming', 'ongoing', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {status === 'all' ? '전체' : status === 'upcoming' ? '예정' : status === 'ongoing' ? '진행중' : '완료'}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium text-gray-700">정렬:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'cost' | 'name')}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                <option value="date">시작일 순</option>
                <option value="cost">비용순</option>
                <option value="name">이름순</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {filteredTravels.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg mb-4">여행이 없습니다</p>
            <button
              onClick={() => router.push('/travel/create')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              새 여행 생성하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredTravels.map((travel) => (
              <TravelCard
                key={travel.id}
                travel={travel}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
