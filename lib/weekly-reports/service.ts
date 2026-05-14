import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendEmailNotification } from './email';

interface WeeklyReportData {
  id?: string;
  year: number;
  week: number;
  week_start_date: string;
  week_end_date: string;
  production: Record<string, any>;
  technology: Record<string, any>;
  maintenance: Record<string, any>;
  management: Record<string, any>;
  status: string;
  generated_by?: string;
  reviewed_by?: string;
  approved_by?: string;
  generated_at?: string;
  reviewed_at?: string;
  approved_at?: string;
}

interface WeeklyCommentData {
  id?: string;
  report_id: string;
  dept_name: string;
  comment_type: 'interpretation' | 'finding' | 'action' | 'note';
  comment: string;
  author_id?: string;
  author_name?: string;
  created_at?: string;
  updated_at?: string;
}

export async function generateWeeklyReport(
  supabase: SupabaseClient,
  year?: number,
  week?: number,
  force: boolean = false,
  triggeredBy: string = 'manual'
) {
  try {
    const { data, error } = await supabase.rpc('generate_weekly_report_auto', {
      p_year: year,
      p_week: week,
      p_force: force,
      p_triggered_by: triggeredBy,
    });

    if (error) throw error;

    const result = {
      success: true,
      report_id: data?.id,
      status: data?.status,
      week: `${data?.year}-W${String(data?.week).padStart(2, '0')}`,
      generated_at: data?.generated_at,
      data_summary: {
        production: {
          actual: data?.production?.actual,
          achievement_rate: data?.production?.achievement_rate,
        },
        technology: {
          equipment_check_count: data?.technology?.equipment_check_count,
          improvement_count: data?.technology?.improvement_count,
        },
        maintenance: {
          bm_incidents: data?.maintenance?.bm_incidents,
          pm_achievement: data?.maintenance?.pm_achievement,
        },
        management: {
          cost_savings: data?.management?.cost_savings,
          safety_incidents: data?.management?.safety_incidents,
        },
      },
    };

    // Queue email notifications to department managers
    try {
      const notificationRecipients = [
        'production@dsc.com',
        'technology@dsc.com',
        'maintenance@dsc.com',
        'management@dsc.com',
      ];

      for (const recipient of notificationRecipients) {
        await sendEmailNotification(supabase, {
          to: recipient,
          subject: `Weekly Report Generated - ${data?.year}-W${String(data?.week).padStart(2, '0')}`,
          template: 'report_generated',
          data: {
            year: data?.year,
            week: data?.week,
            week_start_date: data?.week_start_date,
            week_end_date: data?.week_end_date,
            generated_at: data?.generated_at,
            production: data?.production,
            technology: data?.technology,
            maintenance: data?.maintenance,
            management: data?.management,
          },
        });
      }
    } catch (notifyError) {
      console.warn('Error queuing email notifications:', notifyError);
      // Don't fail the report generation if notifications fail
    }

    return result;
  } catch (error: any) {
    console.error('Error generating weekly report:', error);
    throw new Error(`Failed to generate weekly report: ${error.message}`);
  }
}

export async function getWeeklyReport(
  supabase: SupabaseClient,
  year: number,
  week: number
) {
  try {
    const { data, error } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('year', year)
      .eq('week', week)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    // Fetch comments separately
    const { data: comments, error: commentError } = await supabase
      .from('weekly_comments')
      .select('*')
      .eq('report_id', data.id)
      .order('created_at', { ascending: false });

    if (commentError) throw commentError;

    return {
      ...data,
      comments: comments || [],
      file_status: {
        excel: null,
        pdf: null,
      },
    };
  } catch (error: any) {
    console.error('Error fetching weekly report:', error);
    throw new Error(`Failed to fetch weekly report: ${error.message}`);
  }
}

export async function listWeeklyReports(
  supabase: SupabaseClient,
  year: number,
  month?: number
) {
  try {
    let query = supabase
      .from('weekly_reports_summary')
      .select('*')
      .eq('year', year)
      .order('week', { ascending: false });

    // If month is specified, filter by date range
    if (month) {
      // Calculate week range for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query = query
        .gte('week_start_date', startDate.toISOString().split('T')[0])
        .lte('week_start_date', endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      total: data?.length || 0,
      week_reports: data || [],
    };
  } catch (error: any) {
    console.error('Error listing weekly reports:', error);
    throw new Error(`Failed to list weekly reports: ${error.message}`);
  }
}

export async function reviewWeeklyReport(
  supabase: SupabaseClient,
  reportId: string,
  userId: string,
  departmentsReviewed: string[] = []
) {
  try {
    const { data, error } = await supabase
      .from('weekly_reports')
      .update({
        status: 'reviewed',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;

    // Queue email notifications
    try {
      const notificationRecipients = [
        'production@dsc.com',
        'technology@dsc.com',
        'maintenance@dsc.com',
        'management@dsc.com',
      ];

      for (const recipient of notificationRecipients) {
        await sendEmailNotification(supabase, {
          to: recipient,
          subject: `Weekly Report Reviewed - ${data.year}-W${String(data.week).padStart(2, '0')}`,
          template: 'report_reviewed',
          data: {
            report_id: reportId,
            year: data.year,
            week: data.week,
            reviewed_by: userId,
            reviewed_at: data.reviewed_at,
          },
        });
      }
    } catch (notifyError) {
      console.warn('Error queuing review notifications:', notifyError);
    }

    return {
      success: true,
      id: data.id,
      status: data.status,
      reviewed_at: data.reviewed_at,
      reviewed_by: data.reviewed_by,
    };
  } catch (error: any) {
    console.error('Error reviewing weekly report:', error);
    throw new Error(`Failed to review weekly report: ${error.message}`);
  }
}

export async function approveWeeklyReport(
  supabase: SupabaseClient,
  reportId: string,
  userId: string
) {
  try {
    const { data, error } = await supabase
      .from('weekly_reports')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;

    // Queue email notifications
    try {
      const notificationRecipients = [
        'production@dsc.com',
        'technology@dsc.com',
        'maintenance@dsc.com',
        'management@dsc.com',
      ];

      for (const recipient of notificationRecipients) {
        await sendEmailNotification(supabase, {
          to: recipient,
          subject: `Weekly Report Approved - ${data.year}-W${String(data.week).padStart(2, '0')}`,
          template: 'report_approved',
          data: {
            report_id: reportId,
            year: data.year,
            week: data.week,
            approved_by: userId,
            approved_at: data.approved_at,
          },
        });
      }
    } catch (notifyError) {
      console.warn('Error queuing approval notifications:', notifyError);
    }

    return {
      success: true,
      id: data.id,
      status: data.status,
      approved_at: data.approved_at,
    };
  } catch (error: any) {
    console.error('Error approving weekly report:', error);
    throw new Error(`Failed to approve weekly report: ${error.message}`);
  }
}

export async function addWeeklyComment(
  supabase: SupabaseClient,
  reportId: string,
  deptName: string,
  commentType: 'interpretation' | 'finding' | 'action' | 'note',
  comment: string,
  userId?: string,
  authorName?: string
) {
  try {
    const { data, error } = await supabase
      .from('weekly_comments')
      .insert({
        report_id: reportId,
        dept_name: deptName,
        comment_type: commentType,
        comment,
        author_id: userId,
        author_name: authorName,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      comment_id: data.id,
      created_at: data.created_at,
    };
  } catch (error: any) {
    console.error('Error adding weekly comment:', error);
    throw new Error(`Failed to add weekly comment: ${error.message}`);
  }
}

export async function getWeeklyComments(
  supabase: SupabaseClient,
  reportId: string,
  deptName?: string
) {
  try {
    let query = supabase
      .from('weekly_comments')
      .select('*')
      .eq('report_id', reportId);

    if (deptName) {
      query = query.eq('dept_name', deptName);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return {
      total: data?.length || 0,
      comments: data || [],
    };
  } catch (error: any) {
    console.error('Error fetching weekly comments:', error);
    throw new Error(`Failed to fetch weekly comments: ${error.message}`);
  }
}
