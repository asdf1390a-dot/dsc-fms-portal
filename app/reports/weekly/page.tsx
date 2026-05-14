'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import styles from './page.module.css';

interface WeeklyReport {
  id: string;
  year: number;
  week: number;
  week_start_date: string;
  week_end_date: string;
  status: 'draft' | 'reviewed' | 'approved';
  production: Record<string, any>;
  technology: Record<string, any>;
  maintenance: Record<string, any>;
  management: Record<string, any>;
  generated_at: string;
  reviewed_at?: string;
  approved_at?: string;
}

export default function WeeklyReportsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [exporting, setExporting] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const monthOptions = [
    { value: 1, label: language === 'ko' ? '1월' : 'January' },
    { value: 2, label: language === 'ko' ? '2월' : 'February' },
    { value: 3, label: language === 'ko' ? '3월' : 'March' },
    { value: 4, label: language === 'ko' ? '4월' : 'April' },
    { value: 5, label: language === 'ko' ? '5월' : 'May' },
    { value: 6, label: language === 'ko' ? '6월' : 'June' },
    { value: 7, label: language === 'ko' ? '7월' : 'July' },
    { value: 8, label: language === 'ko' ? '8월' : 'August' },
    { value: 9, label: language === 'ko' ? '9월' : 'September' },
    { value: 10, label: language === 'ko' ? '10월' : 'October' },
    { value: 11, label: language === 'ko' ? '11월' : 'November' },
    { value: 12, label: language === 'ko' ? '12월' : 'December' },
  ];

  useEffect(() => {
    loadReports();
  }, [selectedYear, selectedMonth]);

  async function loadReports() {
    try {
      setLoading(true);
      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const params = new URLSearchParams({ year: selectedYear.toString() });
      if (selectedMonth) {
        params.append('month', selectedMonth.toString());
      }

      const response = await fetch(`/api/weekly-reports?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load weekly reports');
      }

      const data = await response.json();
      setReports(data.week_reports || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(reportId: string, format: 'excel' | 'pdf') {
    try {
      setExporting(reportId);
      const response = await fetch(`/api/weekly-reports/${reportId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const data = await response.json();
      // In real implementation, handle download URL
      alert(language === 'ko' ? '내보내기가 준비 중입니다.' : 'Export is being prepared...');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  }

  async function handleGenerateReport() {
    try {
      const response = await fetch('/api/weekly-reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          force: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      await loadReports();
      alert(language === 'ko' ? '주간 보고서가 생성되었습니다.' : 'Weekly report generated');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate report');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '#FFA500';
      case 'reviewed':
        return '#4169E1';
      case 'approved':
        return '#228B22';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    if (language === 'ko') {
      switch (status) {
        case 'draft':
          return '작성중';
        case 'reviewed':
          return '검토됨';
        case 'approved':
          return '승인됨';
        default:
          return status;
      }
    } else {
      switch (status) {
        case 'draft':
          return 'Draft';
        case 'reviewed':
          return 'Reviewed';
        case 'approved':
          return 'Approved';
        default:
          return status;
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{language === 'ko' ? '주간 보고서' : 'Weekly Reports'}</h1>
        <button onClick={handleGenerateReport} className={styles.generateBtn}>
          {language === 'ko' ? '보고서 생성' : 'Generate Report'}
        </button>
      </div>

      <div className={styles.filters}>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className={styles.select}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={selectedMonth || ''}
          onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : undefined)}
          className={styles.select}
        >
          <option value="">
            {language === 'ko' ? '모든 월' : 'All Months'}
          </option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>
          {language === 'ko' ? '로드 중...' : 'Loading...'}
        </div>
      ) : reports.length === 0 ? (
        <div className={styles.empty}>
          {language === 'ko'
            ? '보고서가 없습니다.'
            : 'No reports found'}
        </div>
      ) : (
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>{language === 'ko' ? '주차' : 'Week'}</th>
                <th>{language === 'ko' ? '기간' : 'Period'}</th>
                <th>{language === 'ko' ? '상태' : 'Status'}</th>
                <th>{language === 'ko' ? '생산' : 'Production'}</th>
                <th>{language === 'ko' ? '기술' : 'Technology'}</th>
                <th>{language === 'ko' ? '보전' : 'Maintenance'}</th>
                <th>{language === 'ko' ? '생산관리' : 'Management'}</th>
                <th>{language === 'ko' ? '작업' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className={styles.weekCell}>
                    {report.year}-W{String(report.week).padStart(2, '0')}
                  </td>
                  <td className={styles.dateCell}>
                    {new Date(report.week_start_date).toLocaleDateString()} ~{' '}
                    {new Date(report.week_end_date).toLocaleDateString()}
                  </td>
                  <td>
                    <span
                      className={styles.status}
                      style={{ backgroundColor: getStatusColor(report.status) }}
                    >
                      {getStatusLabel(report.status)}
                    </span>
                  </td>
                  <td>{report.production?.actual || '-'}</td>
                  <td>{report.technology?.equipment_check_count || '-'}</td>
                  <td>{report.maintenance?.bm_incidents || '-'}</td>
                  <td>{report.management?.cost_savings || '-'}</td>
                  <td className={styles.actions}>
                    <button
                      onClick={() => router.push(`/reports/weekly/${report.id}`)}
                      className={styles.viewBtn}
                    >
                      {language === 'ko' ? '상세' : 'View'}
                    </button>
                    <button
                      onClick={() => handleExport(report.id, 'excel')}
                      disabled={exporting === report.id}
                      className={styles.exportBtn}
                    >
                      {language === 'ko' ? '내보내기' : 'Export'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
