import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const TimelineItem = ({ item, type }) => {
  const isPM = type === 'pm';
  const dateStr = isPM ? item.schedule_date : item.failure_date;
  const statusLabel = item.derived_status || (isPM ? 'Scheduled' : 'Breakdown');
  const statusVariant = {
    'Completed': 'success',
    'Scheduled': 'info',
    'Overdue': 'error',
    'Breakdown': 'error',
    'In Progress': 'warning',
  }[statusLabel] || 'secondary';

  return (
    <div style={{ display: 'flex', gap: 16, paddingBottom: 24, borderBottom: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3b82f6', marginBottom: 8 }} />
        <div style={{ width: 2, height: 48, backgroundColor: '#d1d5db' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {isPM ? item.asset_name : item.equipment_affected}
          </span>
          <Badge variant={statusVariant} size="sm">{statusLabel}</Badge>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{dateStr}</p>
        <p style={{ fontSize: 14, color: '#333', marginBottom: 4 }}>
          {isPM ? item.pm_task || 'Preventive Maintenance' : item.failure_description}
        </p>
        {item.notes && <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Note: {item.notes}</p>}
      </div>
    </div>
  );
};

const PMHistoryTab = ({ assetId }) => {
  const [pmHistory, setPmHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchPMHistory = async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/history?type=pm&limit=20`);
        const data = await res.json();
        setPmHistory(data.pmSchedules || []);
        setHasMore(data.meta?.hasMore);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPMHistory();
  }, [assetId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 16, color: '#666' }}>로딩 중…</div>;
  if (error) return <div style={{ color: '#dc2626', padding: 16 }}>오류: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ backgroundColor: '#dbeafe', padding: 16, borderRadius: 8 }}>
        <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>PM 통계</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: '#666' }}>총 일정</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>{pmHistory.length}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#666' }}>완료율</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>
              {pmHistory.length > 0
                ? Math.round(
                    (pmHistory.filter((p) => p.derived_status === 'Completed').length /
                      pmHistory.length) *
                      100
                  )
                : 0}%
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>타임라인</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pmHistory.length > 0 ? (
            pmHistory.map((item, idx) => (
              <TimelineItem key={idx} item={item} type="pm" />
            ))
          ) : (
            <p style={{ color: '#999', fontSize: 14 }}>PM 기록이 없습니다</p>
          )}
        </div>
      </div>

      {hasMore && (
        <button style={{ width: '100%', padding: 8, color: '#2563eb', fontSize: 14, fontWeight: 600, border: '1px solid #bfdbfe', borderRadius: 6, backgroundColor: 'transparent', cursor: 'pointer' }}>
          더 보기
        </button>
      )}
    </div>
  );
};

const BMHistoryTab = ({ assetId }) => {
  const [bmHistory, setBmHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchBMHistory = async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/history?type=bm&limit=20`);
        const data = await res.json();
        setBmHistory(data.bmEvents || []);
        setHasMore(data.meta?.hasMore);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBMHistory();
  }, [assetId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 16, color: '#666' }}>로딩 중…</div>;
  if (error) return <div style={{ color: '#dc2626', padding: 16 }}>오류: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ backgroundColor: '#fee2e2', padding: 16, borderRadius: 8 }}>
        <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>고장 통계</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: '#666' }}>총 이벤트</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>{bmHistory.length}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#666' }}>심각한 고장</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>
              {bmHistory.filter((b) => b.priority === 'High' || b.priority === 'Critical')
                .length}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>타임라인</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bmHistory.length > 0 ? (
            bmHistory.map((item, idx) => (
              <TimelineItem key={idx} item={item} type="bm" />
            ))
          ) : (
            <p style={{ color: '#999', fontSize: 14 }}>BM 기록이 없습니다</p>
          )}
        </div>
      </div>

      {hasMore && (
        <button style={{ width: '100%', padding: 8, color: '#dc2626', fontSize: 14, fontWeight: 600, border: '1px solid #fecaca', borderRadius: 6, backgroundColor: 'transparent', cursor: 'pointer' }}>
          더 보기
        </button>
      )}
    </div>
  );
};

const AssetHistoryStats = ({ assetId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(3);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/stats?months=${timeRange}`);
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [assetId, timeRange]);

  if (loading) return <div style={{ textAlign: 'center', padding: 16, color: '#666' }}>로딩 중…</div>;
  if (error) return <div style={{ color: '#dc2626', padding: 16 }}>오류: {error}</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: 16, color: '#666' }}>데이터 없음</div>;

  const failureData = stats.failuresByPriority || [];
  const mttrData = [
    { name: 'MTTR', value: stats.mttr || 0 },
    { name: 'Target', value: 24 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Uptime', value: stats.uptime || 0, unit: '%' },
          { label: 'PM Rate', value: stats.pmRate || 0, unit: '%' },
          { label: 'MTTR (hours)', value: stats.mttr?.toFixed(1) || 0, unit: '' },
          { label: 'MTBF (days)', value: stats.mtbf?.toFixed(1) || 0, unit: '' },
        ].map((kpi, i) => (
          <Card key={i} header={kpi.label}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{kpi.value}{kpi.unit}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[3, 6, 12].map((months) => (
          <button
            key={months}
            onClick={() => setTimeRange(months)}
            style={{
              padding: '6px 12px',
              fontSize: 14,
              borderRadius: 6,
              border: 'none',
              backgroundColor: timeRange === months ? '#2563eb' : '#f3f4f6',
              color: timeRange === months ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {months}M
          </button>
        ))}
      </div>

      {failureData.length > 0 && (
        <Card header="Priority별 고장">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={failureData}
                dataKey="count"
                nameKey="priority"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {failureData.map((entry, index) => (
                  <Cell key={index} fill={['#ef4444', '#f97316', '#eab308', '#22c55e'][index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card header="MTTR vs Target">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={mttrData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default function AssetHistoryTabs({ assetId }) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'pm', label: 'PM History' },
    { id: 'bm', label: 'BM History' },
    { id: 'stats', label: 'Statistics' },
  ];

  return (
    <Card header="자산 기록 & 통계">
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16, borderBottom: '1px solid #e0e0e0' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 0',
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? '#2563eb' : '#666',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #2563eb' : 'none',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>최근 PM 활동</h3>
                <PMHistoryTab assetId={assetId} />
              </div>
              <div>
                <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>최근 BM 이벤트</h3>
                <BMHistoryTab assetId={assetId} />
              </div>
            </div>
          )}

          {activeTab === 'pm' && <PMHistoryTab assetId={assetId} />}

          {activeTab === 'bm' && <BMHistoryTab assetId={assetId} />}

          {activeTab === 'stats' && <AssetHistoryStats assetId={assetId} />}
        </div>
      </div>
    </Card>
  );
}
