'use client';

import { useState, useEffect } from 'react';

interface NotificationRule {
  id: string;
  travel_id: string;
  rule_type: string;
  rule_config: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
}

interface Props {
  travelId: string;
  onRefresh: () => void;
}

export default function TravelNotificationsTab({ travelId, onRefresh }: Props) {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    rule_type: 'departure_7days',
    description: '',
  });

  useEffect(() => {
    fetchRules();
  }, [travelId]);

  async function fetchRules() {
    try {
      setLoading(true);
      const token = localStorage.getItem('sb-token');
      if (!token) return;

      const response = await fetch(`/api/travels/${travelId}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch rules');
      }

      setRules(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(ruleId: string, currentEnabled: boolean) {
    try {
      const token = localStorage.getItem('sb-token');
      if (!token) return;

      const response = await fetch(`/api/travels/${travelId}/notifications`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ruleId,
          is_enabled: !currentEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update rule');
      }

      fetchRules();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      const token = localStorage.getItem('sb-token');
      if (!token) return;

      const response = await fetch(`/api/travels/${travelId}/notifications`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ruleId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete rule');
      }

      fetchRules();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  function getRuleLabel(ruleType: string): string {
    switch (ruleType) {
      case 'departure_7days':
        return '출발 7일 전';
      case 'departure_1day':
        return '출발 1일 전';
      case 'departure_24hours':
        return '출발 24시간 전';
      case 'departure_6hours':
        return '출발 6시간 전';
      case 'event_1hour':
        return '각 일정 1시간 전';
      case 'checkout_1day':
        return '체크아웃 1일 전';
      default:
        return ruleType;
    }
  }

  function getRuleDescription(ruleType: string): string {
    switch (ruleType) {
      case 'departure_7days':
        return '여행 준비 알림 (일일 리마인더)';
      case 'departure_1day':
        return '짐 확인 리마인더';
      case 'departure_24hours':
        return '최종 준비 알림';
      case 'departure_6hours':
        return '공항 출발 알림';
      case 'event_1hour':
        return '각 일정별 미리 알림';
      case 'checkout_1day':
        return '체크아웃 준비 알림';
      default:
        return '';
    }
  }

  const presetRules = [
    'departure_7days',
    'departure_1day',
    'departure_24hours',
    'departure_6hours',
    'event_1hour',
    'checkout_1day',
  ];

  const existingRuleTypes = rules.map((r) => r.rule_type);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500">알림 설정 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Automatic Rules */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📅 자동 알림 규칙</h3>
        <div className="space-y-3">
          {presetRules.map((ruleType) => {
            const existingRule = rules.find((r) => r.rule_type === ruleType);
            return (
              <div
                key={ruleType}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{getRuleLabel(ruleType)}</p>
                  <p className="text-sm text-gray-600">{getRuleDescription(ruleType)}</p>
                </div>
                <label className="flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={existingRule?.is_enabled ?? true}
                    onChange={() => {
                      if (existingRule) {
                        handleToggle(existingRule.id, existingRule.is_enabled);
                      } else {
                        // Create new rule with temporary ID
                        handleToggle(`rule-${ruleType}`, false);
                      }
                    }}
                    className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notification Channels */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📢 알림 채널</h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={true}
              disabled
              className="w-5 h-5 text-blue-600 rounded cursor-not-allowed"
            />
            <div className="ml-3 flex-1">
              <p className="font-medium text-gray-900">인앱 알림</p>
              <p className="text-sm text-gray-600">실시간</p>
            </div>
          </div>

          <div className="flex items-center p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={true}
              disabled
              className="w-5 h-5 text-blue-600 rounded cursor-not-allowed"
            />
            <div className="ml-3 flex-1">
              <p className="font-medium text-gray-900">이메일</p>
              <p className="text-sm text-gray-600">asdf1390a@gmail.com</p>
            </div>
          </div>

          <div className="flex items-center p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={true}
              disabled
              className="w-5 h-5 text-blue-600 rounded cursor-not-allowed"
            />
            <div className="ml-3 flex-1">
              <p className="font-medium text-gray-900">Telegram</p>
              <p className="text-sm text-gray-600">Na Kyeongtae 계정</p>
            </div>
          </div>

          <div className="flex items-center p-3 bg-gray-50 rounded-lg opacity-50">
            <input
              type="checkbox"
              disabled
              className="w-5 h-5 text-gray-300 rounded cursor-not-allowed"
            />
            <div className="ml-3 flex-1">
              <p className="font-medium text-gray-500">SMS</p>
              <p className="text-sm text-gray-500">향후 지원</p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Rules */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🔧 커스텀 알림</h3>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            + 새 알림 규칙 추가
          </button>
        )}

        {showAddForm && (
          <div className="space-y-4 mb-4">
            <p className="text-sm text-gray-600">
              현재 MVP에서는 기본 알림 규칙만 지원됩니다. 커스텀 규칙은 다음 버전에서 추가될 예정입니다.
            </p>
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
            >
              취소
            </button>
          </div>
        )}

        {rules.filter((r) => !presetRules.includes(r.rule_type)).length > 0 && (
          <div className="mt-4 space-y-2">
            {rules
              .filter((r) => !presetRules.includes(r.rule_type))
              .map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-gray-900">{rule.rule_config?.description || rule.rule_type}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    삭제
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
