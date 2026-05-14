'use client';

import Link from 'next/link';
import { Travel } from '@/types/travel';

interface TravelCardProps {
  travel: Travel;
  onDelete?: (travelId: string) => void;
}

export default function TravelCard({ travel, onDelete }: TravelCardProps) {
  const getTotalCost = (): number => {
    return travel.costs?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadgeColor = (): string => {
    switch (travel.status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (): string => {
    switch (travel.status) {
      case 'upcoming':
        return '예정';
      case 'ongoing':
        return '진행중';
      case 'completed':
        return '완료';
      default:
        return travel.status;
    }
  };

  const getDaysUntilStart = (): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(travel.start_date);
    start.setHours(0, 0, 0, 0);
    return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getMemberCount = (): number => {
    return travel.members?.length || 0;
  };

  const daysUntilStart = getDaysUntilStart();

  return (
    <Link href={`/travel/${travel.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition cursor-pointer p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{travel.name}</h3>
            <p className="text-gray-600 text-sm mb-3">{travel.location}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ml-4 ${getStatusBadgeColor()}`}>
            {getStatusLabel()}
          </span>
        </div>

        {travel.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{travel.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
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
            <p className="font-semibold text-gray-900">{getMemberCount()}명</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">총 비용</p>
            <p className="font-semibold text-gray-900">₹{getTotalCost().toLocaleString('en-IN')}</p>
          </div>
        </div>

        {daysUntilStart > 0 && daysUntilStart <= 7 && travel.status === 'upcoming' && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-orange-700 text-sm font-medium">
              출발까지 {daysUntilStart}일 남음
            </p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              if (onDelete) {
                onDelete(travel.id);
              }
            }}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            삭제
          </button>
        </div>
      </div>
    </Link>
  );
}
