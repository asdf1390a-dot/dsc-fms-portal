import React, { useState, useEffect } from 'react';

export default function PmBmBadge({ assetId }) {
  const [pmStatus, setPmStatus] = useState(null);
  const [bmStatus, setBmStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/history?limit=1`);
        const data = await res.json();

        const latestPM = data.pmSchedules?.[0];
        const latestBM = data.bmEvents?.[0];

        if (latestPM) {
          const status = latestPM.derived_status || 'Scheduled';
          setPmStatus(status);
        }

        if (latestBM) {
          const priority = latestBM.priority || 'Low';
          const bmStatusMap = {
            Critical: '🔴',
            High: '🟠',
            Medium: '🟡',
            Low: '🟢',
          };
          setBmStatus(bmStatusMap[priority] || '🟢');
        } else {
          setBmStatus('🟢');
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
  }, [assetId]);

  const pmStatusMap = {
    Completed: { icon: '✓完', color: 'bg-green-100 text-green-800' },
    Scheduled: { icon: '⏱予', color: 'bg-blue-100 text-blue-800' },
    Overdue: { icon: '❌連', color: 'bg-red-100 text-red-800' },
  };

  const pmDisplay = pmStatusMap[pmStatus] || { icon: '-', color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="flex gap-1 text-xs font-semibold">
      <span className={`px-2 py-0.5 rounded ${pmDisplay.color}`}>{pmDisplay.icon}</span>
      {!loading && bmStatus && <span className="text-sm">{bmStatus}</span>}
    </div>
  );
}
