'use client';

import { useState } from 'react';
import { Travel } from '@/types/travel';
import { supabase } from '@/lib/supabase';

interface Props {
  travel: Travel;
  onRefresh: () => void;
}

export default function TravelOverviewTab({ travel, onRefresh }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: travel.name,
    location: travel.location,
    description: travel.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    try {
      setSaving(true);
      setSaveError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/travels/${travel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update travel');
      }

      setIsEditing(false);
      onRefresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  function calculateDays(): number {
    const start = new Date(travel.start_date);
    const end = new Date(travel.end_date);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-gray-900">여행 정보</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              수정
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {saveError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">여행 이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">위치</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">이름</p>
              <p className="text-lg font-semibold text-gray-900">{travel.name}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">위치</p>
              <p className="text-gray-700">{travel.location}</p>
            </div>

            {travel.description && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">설명</p>
                <p className="text-gray-700">{travel.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">여행 기간</p>
          <p className="text-2xl font-bold text-gray-900">{calculateDays()}일</p>
          <p className="text-xs text-gray-500 mt-2">
            {new Date(travel.start_date).toLocaleDateString('ko-KR')} ~ {new Date(travel.end_date).toLocaleDateString('ko-KR')}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">상태</p>
          <p className={`text-2xl font-bold ${
            travel.status === 'upcoming' ? 'text-blue-600' :
            travel.status === 'ongoing' ? 'text-green-600' :
            'text-gray-600'
          }`}>
            {travel.status === 'upcoming' ? '예정' : travel.status === 'ongoing' ? '진행중' : '완료'}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">참가자</p>
          <p className="text-2xl font-bold text-gray-900">{travel.members?.length || 0}명</p>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">참가자</h3>
        <div className="space-y-2">
          {travel.members && travel.members.length > 0 ? (
            travel.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{member.user?.user_metadata?.name || member.user_id}</p>
                  <p className="text-sm text-gray-500">{member.role === 'organizer' ? '주최자' : '참가자'}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  member.permission === 'read_write'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {member.permission === 'read_write' ? '편집 가능' : '읽기 전용'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500">참가자가 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
