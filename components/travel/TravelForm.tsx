'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Travel, CreateTravelRequest } from '@/types/travel';

interface TravelFormProps {
  travel?: Travel | null;
  onClose: () => void;
  onSaved: (travel: Travel) => void;
}

const EMPTY: CreateTravelRequest = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  location: '',
};

export default function TravelForm({ travel, onClose, onSaved }: TravelFormProps) {
  const isEdit = Boolean(travel);
  const [form, setForm] = useState<CreateTravelRequest>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (travel) {
      setForm({
        name: travel.name || '',
        description: travel.description || '',
        start_date: travel.start_date || '',
        end_date: travel.end_date || '',
        location: travel.location || '',
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [travel]);

  const update = <K extends keyof CreateTravelRequest>(key: K, value: CreateTravelRequest[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('여행 이름을 입력해 주세요.');
      return;
    }
    if (!form.location.trim()) {
      setError('여행지를 입력해 주세요.');
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError('시작일과 종료일을 입력해 주세요.');
      return;
    }
    if (form.start_date > form.end_date) {
      setError('종료일은 시작일 이후여야 합니다.');
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('로그인이 필요합니다.');
      }

      const url = isEdit ? `/api/travels/${travel!.id}` : '/api/travels';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description?.trim() || undefined,
          start_date: form.start_date,
          end_date: form.end_date,
          location: form.location.trim(),
        }),
      });

      const body = await res.json();
      if (!res.ok || !body?.data) {
        throw new Error(body?.error || `저장 실패 (${res.status})`);
      }

      onSaved(body.data as Travel);
    } catch (e) {
      console.error('Save travel error:', e);
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? '여행 수정' : '새 여행 등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              여행 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="예: 2026 상반기 HQ 출장"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              여행지 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="예: 서울, 한국"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => update('end_date', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="여행 목적, 참고사항 등"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={1000}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : isEdit ? '저장' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
