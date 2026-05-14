'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Travel {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  travel_members: Array<{ id: string }>;
  travel_costs: Array<{ amount: string }>;
}

interface TravelsResponse {
  success: boolean;
  data: Travel[];
  message: string;
}

export default function TravelListPage() {
  const router = useRouter();
  const [travels, setTravels] = useState<Travel[]>([]);
  const [filteredTravels, setFilteredTravels] = useState<Travel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'start_date' | 'name'>('start_date');

  useEffect(() => {
    fetchTravels();
  }, []);

  useEffect(() => {
    filterAndSortTravels();
  }, [travels, statusFilter, sortBy]);

  async function fetchTravels() {
    try {
      setLoading(true);
      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/travels', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as TravelsResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch travels');
      }

      setTravels(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Fetch travels error:', err);
    } finally {
      setLoading(false);
    }
  }

  function filterAndSortTravels() {
    let filtered = travels;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'start_date') {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else {
        return a.name.localeCompare(b.name);
      }
    });

    setFilteredTravels(filtered);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getTotalCost(travel: Travel): number {
    return travel.travel_costs.reduce((sum, cost) => sum + parseFloat(cost.amount.toString()), 0);
  }

  function getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'upcoming':
        return '예정';
      case 'ongoing':
        return '진행중';
      case 'completed':
        return '완료';
      default:
        return status;
    }
  }

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

          {/* Filters and Sort */}
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
                  {status === 'all' ? '전체' : getStatusLabel(status)}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium text-gray-700">정렬:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'start_date' | 'name')}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                <option value="start_date">시작일 순</option>
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
              <Link key={travel.id} href={`/travel/${travel.id}`}>
                <div className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition cursor-pointer p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{travel.name}</h3>
                      <p className="text-gray-600 text-sm mb-3">{travel.location}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(travel.status)}`}>
                      {getStatusLabel(travel.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">시작일</p>
                      <p className="font-semibold text-gray-900">{formatDate(travel.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">종료일</p>
                      <p className="font-semibold text-gray-900">{formatDate(travel.end_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">참가자</p>
                      <p className="font-semibold text-gray-900">{travel.travel_members?.length || 0}명</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">총 비용</p>
                      <p className="font-semibold text-gray-900">₹{getTotalCost(travel).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
