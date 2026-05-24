'use client';

export type TravelTab =
  | 'overview'
  | 'schedule'
  | 'costs'
  | 'checklist'
  | 'documents'
  | 'notifications';

interface TabNavigationProps {
  activeTab: TravelTab;
  onChange: (tab: TravelTab) => void;
}

const TABS: { id: TravelTab; label: string; icon: string }[] = [
  { id: 'overview', label: '개요', icon: '📋' },
  { id: 'schedule', label: '일정', icon: '📅' },
  { id: 'costs', label: '비용', icon: '💰' },
  { id: 'checklist', label: '체크리스트', icon: '✅' },
  { id: 'documents', label: '문서', icon: '📄' },
  { id: 'notifications', label: '알림', icon: '🔔' },
];

export default function TabNavigation({ activeTab, onChange }: TabNavigationProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <nav className="flex overflow-x-auto -mb-px" aria-label="Travel tabs">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
