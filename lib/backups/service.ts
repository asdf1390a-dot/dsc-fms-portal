import { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'success' | 'failure' | 'quota_warning' | 'quota_exceeded' | 'deletion_scheduled';
export type NotificationChannel = 'email' | 'telegram' | 'in_app';

export interface QuotaStatus {
  plan_type: string;
  max_storage_bytes: number | null;
  current_usage_bytes: number;
  usage_percent: number;
  warning_threshold_percent: number;
  is_warning: boolean;
  is_exceeded: boolean;
  last_calculated_at: string;
}

export async function getBackupPolicy(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('backup_policies')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    return null;
  }
  if (error) throw error;
  return data;
}

export async function getOrCreateBackupPolicy(
  supabase: SupabaseClient,
  userId: string
) {
  let policy = await getBackupPolicy(supabase, userId);

  if (!policy) {
    const { data, error } = await supabase
      .from('backup_policies')
      .insert({
        user_id: userId,
        backup_enabled: true,
        backup_time: '02:00',
        backup_interval: 'daily',
        retention_days: 90,
        auto_delete_enabled: true,
        max_storage_bytes: 10737418240,
        warning_threshold_percent: 80,
      })
      .select()
      .single();

    if (error) throw error;
    policy = data;
  }

  return policy;
}

export async function getQuotaStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<QuotaStatus> {
  const { data: quota } = await supabase
    .from('backup_storage_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: backups } = await supabase
    .from('backups')
    .select('size_bytes')
    .eq('user_id', userId)
    .eq('status', 'completed');

  const currentUsage = backups?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;
  const maxStorage = quota?.max_storage_bytes;
  const usagePercent = maxStorage ? Math.round((currentUsage / maxStorage) * 100) : 0;

  return {
    plan_type: quota?.plan_type || 'standard',
    max_storage_bytes: maxStorage,
    current_usage_bytes: currentUsage,
    usage_percent: usagePercent,
    warning_threshold_percent: quota?.warning_threshold_percent || 80,
    is_warning: usagePercent >= (quota?.warning_threshold_percent || 80),
    is_exceeded: maxStorage ? currentUsage > maxStorage : false,
    last_calculated_at: quota?.last_calculated_at || new Date().toISOString(),
  };
}

export async function sendNotification(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  message: string,
  channel: NotificationChannel,
  backupId?: string
): Promise<void> {
  const { error } = await supabase
    .from('backup_notifications')
    .insert({
      user_id: userId,
      notification_type: type,
      message,
      notification_channel: channel,
      backup_id: backupId || null,
      sent_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function calculateMetrics(
  supabase: SupabaseClient,
  userId: string,
  metricDate: string
): Promise<void> {
  const date = new Date(metricDate);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: backups } = await supabase
    .from('backups')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', endOfDay.toISOString());

  if (!backups || backups.length === 0) return;

  const successCount = backups.filter(b => b.status === 'completed').length;
  const failureCount = backups.filter(b => b.status === 'failed').length;
  const totalSize = backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
  const durations = backups
    .filter(b => b.created_at && b.completed_at)
    .map(b => (new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 1000);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0;
  const maxDuration = durations.length ? Math.max(...durations) : 0;

  const { error } = await supabase
    .from('backup_metrics')
    .upsert({
      user_id: userId,
      metric_date: metricDate,
      total_backups: backups.length,
      successful_backups: successCount,
      failed_backups: failureCount,
      skipped_backups: 0,
      total_size_bytes: totalSize,
      average_duration_seconds: avgDuration,
      max_duration_seconds: maxDuration,
    }, { onConflict: 'user_id,metric_date' });

  if (error) throw error;
}

export async function getExpiredBackups(
  supabase: SupabaseClient,
  userId: string,
  retentionDays: number
) {
  const { data, error } = await supabase
    .rpc('get_expired_backups', {
      user_id_param: userId,
      retention_days: retentionDays,
    });

  if (error) throw error;
  return data || [];
}
