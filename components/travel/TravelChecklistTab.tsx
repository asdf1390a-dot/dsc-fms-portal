'use client';

import { useState } from 'react';
import { TravelChecklistItem } from '@/types/travel';
import { supabase } from '@/lib/supabase';

interface Props {
  travelId: string;
  items: TravelChecklistItem[];
  onRefresh: () => void;
}

export default function TravelChecklistTab({ travelId, items: initialItems, onRefresh }: Props) {
  const [items, setItems] = useState<TravelChecklistItem[]>(initialItems || []);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'documents',
    priority: 'medium',
    description: '',
  });

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/travels/${travelId}/checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add checklist item');
      }

      setFormData({
        title: '',
        category: 'documents',
        priority: 'medium',
        description: '',
      });
      setShowForm(false);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleItem(itemId: string, isCompleted: boolean) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/travels/${travelId}/checklist`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          itemId,
          is_completed: !isCompleted,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update item');
      }

      onRefresh();
    } catch (err) {
      console.error('Toggle item error:', err);
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      const token = localStorage.getItem('sb-token');
      if (!token) return;

      const response = await fetch(`/api/travels/${travelId}/checklist`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete item');
      }

      onRefresh();
    } catch (err) {
      console.error('Delete item error:', err);
    }
  }

  function getCategoryLabel(category: string): string {
    switch (category) {
      case 'documents':
        return '문서';
      case 'bookings':
        return '예약';
      case 'packing':
        return '짐 준비';
      case 'shopping':
        return '쇼핑';
      case 'other':
        return '기타';
      default:
        return category;
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  function getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'high':
        return '높음';
      case 'medium':
        return '중간';
      case 'low':
        return '낮음';
      default:
        return priority;
    }
  }

  const completedCount = items.filter((item) => item.is_completed).length;

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    const category = item.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, TravelChecklistItem[]>);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm font-medium text-gray-500 mb-2">진행도</p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
          <p className="font-semibold text-gray-900">
            {completedCount}/{items.length}
          </p>
        </div>
      </div>

      {/* Add Item Form */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
        >
          + 항목 추가
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">새 항목</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAddItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">항목</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="예: 여권 준비"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">분류</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="documents">문서</option>
                  <option value="bookings">예약</option>
                  <option value="packing">짐 준비</option>
                  <option value="shopping">쇼핑</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="high">높음</option>
                  <option value="medium">중간</option>
                  <option value="low">낮음</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">설명 (선택)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                {loading ? '추가 중...' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items by Category */}
      {Object.keys(itemsByCategory).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
            <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900">{getCategoryLabel(category)}</h4>
              </div>
              <div className="divide-y divide-gray-200">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => handleToggleItem(item.id, item.is_completed)}
                      className="mt-1 w-5 h-5 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          item.is_completed
                            ? 'text-gray-400 line-through'
                            : 'text-gray-900'
                        }`}
                      >
                        {item.title}
                      </p>
                      {item.notes && (
                        <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getPriorityColor(item.priority || 'medium')}`}>
                        {getPriorityLabel(item.priority || 'medium')}
                      </span>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          체크리스트가 없습니다
        </div>
      )}
    </div>
  );
}
