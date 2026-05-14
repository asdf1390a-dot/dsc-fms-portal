'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreateTravelRequest {
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  description?: string;
}

interface CreateTravelResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    location: string;
    description?: string;
    status: string;
    created_at: string;
  };
  error?: {
    message: string;
  };
  message?: string;
}

export default function CreateTravelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    description: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.location || !formData.start_date || !formData.end_date) {
      setError('필수 필드를 모두 입력해주세요');
      return;
    }

    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      setError('시작일이 종료일보다 늦을 수 없습니다');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const payload: CreateTravelRequest = {
        name: formData.name,
        location: formData.location,
        start_date: formData.start_date,
        end_date: formData.end_date,
      };

      if (formData.description) {
        payload.description = formData.description;
      }

      const response = await fetch('/api/travels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as CreateTravelResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to create travel');
      }

      router.push(`/travel/${data.data?.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function calculateDays(): number {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium mb-6 flex items-center gap-1"
          >
            ← 뒤로가기
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">새 여행 생성</h1>
          <p className="text-gray-600">여행의 기본 정보를 입력해주세요</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Travel Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                여행명 *
              </label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: Ho Chi Minh City"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">여행의 제목이나 목적지를 입력하세요</p>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                지역/도시 *
              </label>
              <input
                id="location"
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="예: Ho Chi Minh City, Vietnam"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">주요 도시와 국가를 입력하세요</p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                  시작일 *
                </label>
                <input
                  id="start_date"
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                  종료일 *
                </label>
                <input
                  id="end_date"
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Duration Info */}
            {formData.start_date && formData.end_date && calculateDays() > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  ⏱️ 여행 기간: <strong>{calculateDays()}일</strong>
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                설명 (선택사항)
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="여행의 목적, 동반자, 특별한 계획 등을 입력하세요"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">나중에 수정할 수 있습니다</p>
            </div>

            {/* Submit and Cancel Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition"
              >
                {loading ? '생성 중...' : '여행 생성'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            💡 <strong>팁:</strong> 여행을 생성한 후 동반자를 추가하고, 일정, 비용, 준비물 등을 관리할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
