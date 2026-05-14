'use client';

import { useState, useEffect } from 'react';

interface TravelEvent {
  id: string;
  travel_id: string;
  title: string;
  event_type: string;
  event_date: string;
  event_time?: string;
  location?: string;
  description?: string;
  status: string;
}

interface Props {
  travelId: string;
  events: TravelEvent[];
  onRefresh: () => void;
}

export default function TravelScheduleTab({ travelId, events: initialEvents, onRefresh }: Props) {
  const [events, setEvents] = useState<TravelEvent[]>(initialEvents || []);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'flight',
    event_date: '',
    event_time: '',
    location: '',
    description: '',
  });

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('sb-token');
      if (!token) return;

      const response = await fetch(`/api/travels/${travelId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to add event');
      }

      setFormData({
        title: '',
        event_type: 'flight',
        event_date: '',
        event_time: '',
        location: '',
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

  function getEventIcon(type: string): string {
    switch (type) {
      case 'flight':
        return '✈️';
      case 'hotel':
        return '🏨';
      case 'meal':
        return '🍽️';
      case 'transport':
        return '🚗';
      default:
        return '📌';
    }
  }

  function getEventTypeLabel(type: string): string {
    switch (type) {
      case 'flight':
        return '항공편';
      case 'hotel':
        return '숙박';
      case 'meal':
        return '식사';
      case 'transport':
        return '교통';
      default:
        return type;
    }
  }

  const sortedEvents = [...events].sort((a, b) =>
    new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Add Event Form */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
        >
          + 일정 추가
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">새 일정</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAddEvent} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="예: 서울 출발"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="flight">항공편</option>
                  <option value="hotel">숙박</option>
                  <option value="meal">식사</option>
                  <option value="transport">교통</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
                <input
                  type="date"
                  required
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
                <input
                  type="time"
                  value={formData.event_time}
                  onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
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
                  placeholder="예: 인천공항"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
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

      {/* Events Timeline */}
      {sortedEvents.length > 0 ? (
        <div className="space-y-4">
          {sortedEvents.map((event, index) => (
            <div key={event.id} className="relative">
              {index < sortedEvents.length - 1 && (
                <div className="absolute left-6 top-14 w-0.5 h-12 bg-gray-200"></div>
              )}
              <div className="bg-white rounded-lg border border-gray-200 p-6 ml-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl mt-1">{getEventIcon(event.event_type)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">{event.title}</h4>
                        <p className="text-sm text-gray-500">{getEventTypeLabel(event.event_type)}</p>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {new Date(event.event_date).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    {event.event_time && (
                      <p className="text-sm text-gray-600">⏰ {event.event_time}</p>
                    )}
                    {event.location && (
                      <p className="text-sm text-gray-600">📍 {event.location}</p>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-700 mt-2">{event.description}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          일정이 없습니다
        </div>
      )}
    </div>
  );
}
