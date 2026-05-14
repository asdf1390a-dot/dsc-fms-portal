'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTravelData } from '@/hooks/useTravelData';
import TravelOverviewTab from '../../../components/travel/TravelOverviewTab';
import TravelScheduleTab from '../../../components/travel/TravelScheduleTab';
import TravelCostsTab from '../../../components/travel/TravelCostsTab';
import TravelChecklistTab from '../../../components/travel/TravelChecklistTab';
import TravelDocumentsTab from '../../../components/travel/TravelDocumentsTab';
import TravelNotificationsTab from '../../../components/travel/TravelNotificationsTab';

type TabType = 'overview' | 'schedule' | 'costs' | 'checklist' | 'documents' | 'notifications';

export default function TravelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const travelId = (params?.id as string) || '';

  const { travel, loading, error, refetch } = useTravelData(travelId);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabConfig = [
    { id: 'overview' as TabType, label: '개요', icon: '📋' },
    { id: 'schedule' as TabType, label: '일정', icon: '📅' },
    { id: 'costs' as TabType, label: '비용', icon: '💰' },
    { id: 'checklist' as TabType, label: '체크리스트', icon: '✓' },
    { id: 'documents' as TabType, label: '문서', icon: '📄' },
    { id: 'notifications' as TabType, label: '알림', icon: '🔔' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">여행 정보 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !travel) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 text-center">
          <p className="text-red-600 text-lg mb-4">{error || '여행을 찾을 수 없습니다'}</p>
          <button
            onClick={() => router.push('/travel')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            여행 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{travel.name}</h1>
              <p className="text-gray-600 text-lg">{travel.location}</p>
            </div>
            <button
              onClick={() => router.push('/travel')}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {travel.description && <p className="text-gray-700 mb-6">{travel.description}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">시작일</p>
              <p className="font-semibold text-gray-900">
                {new Date(travel.start_date).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">종료일</p>
              <p className="font-semibold text-gray-900">
                {new Date(travel.end_date).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">상태</p>
              <p className="font-semibold text-gray-900">
                {travel.status === 'upcoming' ? '예정' : travel.status === 'ongoing' ? '진행중' : '완료'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">참가자</p>
              <p className="font-semibold text-gray-900">{travel.members?.length || 0}명</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1">
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {activeTab === 'overview' && <TravelOverviewTab travel={travel} onRefresh={refetch} />}
        {activeTab === 'schedule' && <TravelScheduleTab travelId={travel.id} events={travel?.events || []} onRefresh={refetch} />}
        {activeTab === 'costs' && <TravelCostsTab travelId={travel.id} costs={travel?.costs || []} onRefresh={refetch} />}
        {activeTab === 'checklist' && <TravelChecklistTab travelId={travel.id} items={travel?.checklist_items || []} onRefresh={refetch} />}
        {activeTab === 'documents' && <TravelDocumentsTab travelId={travel.id} documents={travel?.documents || []} onRefresh={refetch} />}
        {activeTab === 'notifications' && <TravelNotificationsTab travelId={travel.id} onRefresh={refetch} />}
      </div>
    </div>
  );
}
