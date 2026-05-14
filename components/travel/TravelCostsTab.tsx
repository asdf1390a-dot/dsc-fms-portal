'use client';

import { useState } from 'react';

interface TravelCost {
  id: string;
  title: string;
  amount: number;
  currency: string;
  cost_type?: string;
  cost_date: string;
  payer_id: string;
}

interface Props {
  travelId: string;
  costs: TravelCost[];
  onRefresh: () => void;
}

export default function TravelCostsTab({ travelId, costs: initialCosts, onRefresh }: Props) {
  const [costs, setCosts] = useState<TravelCost[]>(initialCosts || []);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    currency: 'INR',
    cost_type: 'accommodation',
    cost_date: '',
  });

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('sb-token');
      if (!token) return;

      const response = await fetch(`/api/travels/${travelId}/costs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to add cost');
      }

      setFormData({
        title: '',
        amount: '',
        currency: 'INR',
        cost_type: 'accommodation',
        cost_date: '',
      });
      setShowForm(false);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function getCostTypeLabel(type?: string): string {
    switch (type) {
      case 'accommodation':
        return '숙박';
      case 'food':
        return '식사';
      case 'transport':
        return '교통';
      case 'activities':
        return '활동';
      case 'shopping':
        return '쇼핑';
      default:
        return '기타';
    }
  }

  function getTotalCost(): number {
    return costs.reduce((sum, cost) => sum + parseFloat(cost.amount.toString()), 0);
  }

  const sortedCosts = [...costs].sort((a, b) =>
    new Date(b.cost_date).getTime() - new Date(a.cost_date).getTime()
  );

  const costsByType = costs.reduce((acc, cost) => {
    const type = cost.cost_type || 'other';
    if (!acc[type]) {
      acc[type] = 0;
    }
    acc[type] += parseFloat(cost.amount.toString());
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">총 비용</p>
          <p className="text-2xl font-bold text-gray-900">₹{getTotalCost().toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">항목 수</p>
          <p className="text-2xl font-bold text-gray-900">{costs.length}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 mb-2">1인당 평균</p>
          <p className="text-2xl font-bold text-gray-900">₹{Math.round(getTotalCost()).toLocaleString()}</p>
        </div>
      </div>

      {/* Cost Breakdown */}
      {Object.keys(costsByType).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">비용 분류</h3>
          <div className="space-y-2">
            {Object.entries(costsByType).map(([type, amount]) => (
              <div key={type} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{getCostTypeLabel(type)}</p>
                <p className="font-semibold text-gray-900">₹{amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Cost Form */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
        >
          + 비용 추가
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">새 비용</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAddCost} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="예: 호텔 예약"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">금액</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">통화</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="INR">인도 루피 (₹)</option>
                  <option value="USD">미국 달러 ($)</option>
                  <option value="EUR">유로 (€)</option>
                  <option value="KRW">한국 원 (₩)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">분류</label>
                <select
                  value={formData.cost_type}
                  onChange={(e) => setFormData({ ...formData, cost_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="accommodation">숙박</option>
                  <option value="food">식사</option>
                  <option value="transport">교통</option>
                  <option value="activities">활동</option>
                  <option value="shopping">쇼핑</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
                <input
                  type="date"
                  required
                  value={formData.cost_date}
                  onChange={(e) => setFormData({ ...formData, cost_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
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

      {/* Costs List */}
      {sortedCosts.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">내용</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">분류</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">금액</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{cost.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{getCostTypeLabel(cost.cost_type)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ₹{parseFloat(cost.amount.toString()).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(cost.cost_date).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          비용이 없습니다
        </div>
      )}
    </div>
  );
}
