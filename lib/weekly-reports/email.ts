import { SupabaseClient } from '@supabase/supabase-js';

export interface EmailNotification {
  to: string;
  subject: string;
  template: 'report_generated' | 'report_reviewed' | 'report_approved';
  data: Record<string, any>;
}

export async function sendEmailNotification(
  supabase: SupabaseClient,
  notification: EmailNotification
) {
  try {
    // Store notification in database for async processing
    const { data, error } = await supabase
      .from('email_notifications')
      .insert({
        recipient: notification.to,
        subject: notification.subject,
        template: notification.template,
        data: notification.data,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Log notification
    console.log(`Email notification queued: ${notification.to} (${notification.template})`);

    return {
      success: true,
      notification_id: data?.id,
    };
  } catch (error: any) {
    console.error('Error queueing email notification:', error);
    throw new Error(`Failed to queue email notification: ${error.message}`);
  }
}

export function generateEmailContent(
  template: EmailNotification['template'],
  data: Record<string, any>,
  language: string = 'ko'
): { subject: string; body: string } {
  const templates: Record<string, Record<string, { subject: string; body: string }>> = {
    report_generated: {
      ko: {
        subject: `[DSC] 주간 보고서 생성됨 - ${data.year}-W${String(data.week).padStart(2, '0')}`,
        body: `
주간 보고서가 자동으로 생성되었습니다.

보고서: ${data.year}-W${String(data.week).padStart(2, '0')}
기간: ${data.week_start_date} ~ ${data.week_end_date}
상태: 작성중
생성일: ${data.generated_at}

다음 부서의 데이터가 포함되었습니다:
- 생산: ${data.production?.actual || '-'} (달성률: ${data.production?.achievement_rate || '-'})
- 기술: 설비 점검 ${data.technology?.equipment_check_count || '-'}건
- 보전: BM 발생 ${data.maintenance?.bm_incidents || '-'}건
- 생산관리: 비용절감 ${data.management?.cost_savings || '-'}

자세한 내용을 보려면 아래 링크를 클릭하세요:
${process.env.NEXT_PUBLIC_BASE_URL}/reports/weekly`,
      },
      en: {
        subject: `[DSC] Weekly Report Generated - ${data.year}-W${String(data.week).padStart(2, '0')}`,
        body: `
Weekly report has been automatically generated.

Report: ${data.year}-W${String(data.week).padStart(2, '0')}
Period: ${data.week_start_date} ~ ${data.week_end_date}
Status: Draft
Generated: ${data.generated_at}

Data included from departments:
- Production: ${data.production?.actual || '-'} (Achievement: ${data.production?.achievement_rate || '-'})
- Technology: ${data.technology?.equipment_check_count || '-'} equipment checks
- Maintenance: ${data.maintenance?.bm_incidents || '-'} BM incidents
- Management: Cost savings ${data.management?.cost_savings || '-'}

Click the link below to view details:
${process.env.NEXT_PUBLIC_BASE_URL}/reports/weekly`,
      },
    },
    report_reviewed: {
      ko: {
        subject: `[DSC] 주간 보고서 검토됨 - ${data.year}-W${String(data.week).padStart(2, '0')}`,
        body: `
주간 보고서가 검토되었습니다.

보고서: ${data.year}-W${String(data.week).padStart(2, '0')}
상태: 검토됨
검토자: ${data.reviewed_by || '-'}
검토일: ${data.reviewed_at}

다음 링크에서 검토 의견을 확인할 수 있습니다:
${process.env.NEXT_PUBLIC_BASE_URL}/reports/weekly/${data.report_id}`,
      },
      en: {
        subject: `[DSC] Weekly Report Reviewed - ${data.year}-W${String(data.week).padStart(2, '0')}`,
        body: `
Weekly report has been reviewed.

Report: ${data.year}-W${String(data.week).padStart(2, '0')}
Status: Reviewed
Reviewed by: ${data.reviewed_by || '-'}
Review date: ${data.reviewed_at}

Click the link below to view review comments:
${process.env.NEXT_PUBLIC_BASE_URL}/reports/weekly/${data.report_id}`,
      },
    },
    report_approved: {
      ko: {
        subject: `[DSC] 주간 보고서 승인됨 - ${data.year}-W${String(data.week).padStart(2, '0')}`,
        body: `
주간 보고서가 승인되었습니다.

보고서: ${data.year}-W${String(data.week).padStart(2, '0')}
상태: 승인됨
승인자: ${data.approved_by || '-'}
승인일: ${data.approved_at}

자세한 내용은 다음 링크를 확인하세요:
${process.env.NEXT_PUBLIC_BASE_URL}/reports/weekly/${data.report_id}`,
      },
      en: {
        subject: `[DSC] Weekly Report Approved - ${data.year}-W${String(data.week).padStart(2, '0')}`,
        body: `
Weekly report has been approved.

Report: ${data.year}-W${String(data.week).padStart(2, '0')}
Status: Approved
Approved by: ${data.approved_by || '-'}
Approval date: ${data.approved_at}

Click the link below to view details:
${process.env.NEXT_PUBLIC_BASE_URL}/reports/weekly/${data.report_id}`,
      },
    },
  };

  const template_lang = templates[template]?.[language];
  if (!template_lang) {
    // Fallback to English if language not available
    return templates[template]?.en || { subject: 'Report', body: '' };
  }

  return template_lang;
}
