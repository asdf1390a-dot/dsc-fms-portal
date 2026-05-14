'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  comments: Array<{
    id: string;
    dept_name: string;
    comment_type: string;
    comment: string;
    author_name?: string;
    created_at: string;
  }>;
}

interface DepartmentMetrics {
  production: { label: string; value: any }[];
  technology: { label: string; value: any }[];
  maintenance: { label: string; value: any }[];
  management: { label: string; value: any }[];
}

export default function WeeklyReportDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string } | null;
  const { language } = useLanguage();
  const reportId = params?.id as string;

  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('production');
  const [commentType, setCommentType] = useState<'interpretation' | 'finding' | 'action' | 'note'>(
    'interpretation'
  );

  const deptLabels = {
    production: language === 'ko' ? '생산' : 'Production',
    technology: language === 'ko' ? '기술' : 'Technology',
    maintenance: language === 'ko' ? '보전' : 'Maintenance',
    management: language === 'ko' ? '생산관리' : 'Management',
  };

  useEffect(() => {
    loadReport();
  }, [reportId]);

  async function loadReport() {
    try {
      setLoading(true);
      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(
        `/api/weekly-reports?year=${new Date().getFullYear()}&week=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load report');
      }

      const data = await response.json();
      const foundReport = data.week_reports?.find((r: WeeklyReport) => r.id === reportId);
      if (!foundReport) {
        throw new Error('Report not found');
      }
      setReport(foundReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    try {
      setIsApproving(true);
      const response = await fetch(`/api/weekly-reports/${reportId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to approve report');
      }

      await loadReport();
      alert(language === 'ko' ? '보고서가 승인되었습니다.' : 'Report approved');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/weekly-reports/${reportId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          department: selectedDept,
          comment_type: commentType,
          content: newComment,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      setNewComment('');
      await loadReport();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment');
    }
  }

  if (loading) {
    return <div className={styles.container}>{language === 'ko' ? '로드 중...' : 'Loading...'}</div>;
  }

  if (error) {
    return <div className={styles.container}>{error}</div>;
  }

  if (!report) {
    return <div className={styles.container}>{language === 'ko' ? '보고서를 찾을 수 없습니다.' : 'Report not found'}</div>;
  }

  const metrics: DepartmentMetrics = {
    production: [
      { label: language === 'ko' ? '목표 생산량' : 'Target Output', value: report.production?.target },
      { label: language === 'ko' ? '실제 생산량' : 'Actual Output', value: report.production?.actual },
      { label: language === 'ko' ? '달성률' : 'Achievement', value: report.production?.achievement_rate },
    ],
    technology: [
      { label: language === 'ko' ? '설비 점검 건수' : 'Equipment Checks', value: report.technology?.equipment_check_count },
      { label: language === 'ko' ? '개선 건수' : 'Improvements', value: report.technology?.improvement_count },
    ],
    maintenance: [
      { label: language === 'ko' ? 'BM 발생 건수' : 'BM Incidents', value: report.maintenance?.bm_incidents },
      { label: language === 'ko' ? 'PM 달성율' : 'PM Achievement', value: report.maintenance?.pm_achievement },
    ],
    management: [
      { label: language === 'ko' ? '비용 절감' : 'Cost Savings', value: report.management?.cost_savings },
      { label: language === 'ko' ? '안전 사건 건수' : 'Safety Incidents', value: report.management?.safety_incidents },
    ],
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          ← {language === 'ko' ? '돌아가기' : 'Back'}
        </button>
        <h1>
          {report.year}-W{String(report.week).padStart(2, '0')}
        </h1>
        <div className={styles.headerActions}>
          <span className={styles.status} style={{ backgroundColor: '#4169E1' }}>
            {report.status}
          </span>
          {report.status !== 'approved' && (
            <button onClick={handleApprove} disabled={isApproving} className={styles.approveBtn}>
              {language === 'ko' ? '승인' : 'Approve'}
            </button>
          )}
        </div>
      </div>

      <div className={styles.dateInfo}>
        {language === 'ko' ? '기간: ' : 'Period: '}
        {new Date(report.week_start_date).toLocaleDateString()} ~{' '}
        {new Date(report.week_end_date).toLocaleDateString()}
      </div>

      <div className={styles.metricsGrid}>
        {(Object.keys(metrics) as Array<keyof DepartmentMetrics>).map((dept) => (
          <div key={dept} className={styles.metricCard}>
            <h3>{deptLabels[dept]}</h3>
            <div className={styles.metricsList}>
              {metrics[dept].map((metric, idx) => (
                <div key={idx} className={styles.metricRow}>
                  <span className={styles.metricLabel}>{metric.label}</span>
                  <span className={styles.metricValue}>{metric.value || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.commentsSection}>
        <h2>{language === 'ko' ? '의견 및 평가' : 'Comments & Feedback'}</h2>

        <div className={styles.addCommentForm}>
          <div className={styles.formGroup}>
            <label>{language === 'ko' ? '부서' : 'Department'}</label>
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="production">{deptLabels.production}</option>
              <option value="technology">{deptLabels.technology}</option>
              <option value="maintenance">{deptLabels.maintenance}</option>
              <option value="management">{deptLabels.management}</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>{language === 'ko' ? '유형' : 'Type'}</label>
            <select value={commentType} onChange={(e) => setCommentType(e.target.value as any)}>
              <option value="interpretation">{language === 'ko' ? '분석' : 'Interpretation'}</option>
              <option value="finding">{language === 'ko' ? '발견사항' : 'Finding'}</option>
              <option value="action">{language === 'ko' ? '조치' : 'Action'}</option>
              <option value="note">{language === 'ko' ? '비고' : 'Note'}</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>{language === 'ko' ? '의견' : 'Comment'}</label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={language === 'ko' ? '의견을 입력하세요...' : 'Enter your comment...'}
              rows={4}
            />
          </div>

          <button onClick={handleAddComment} className={styles.submitBtn}>
            {language === 'ko' ? '댓글 추가' : 'Add Comment'}
          </button>
        </div>

        <div className={styles.commentsList}>
          {report.comments && report.comments.length > 0 ? (
            report.comments.map((comment) => (
              <div key={comment.id} className={styles.commentItem}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentDept}>{deptLabels[comment.dept_name as keyof typeof deptLabels]}</span>
                  <span className={styles.commentType}>{comment.comment_type}</span>
                  <span className={styles.commentDate}>
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className={styles.commentText}>{comment.comment}</p>
                {comment.author_name && (
                  <span className={styles.commentAuthor}>— {comment.author_name}</span>
                )}
              </div>
            ))
          ) : (
            <div className={styles.noComments}>
              {language === 'ko' ? '의견이 없습니다.' : 'No comments yet'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
