export interface BackupPolicy {
  id: string;
  user_id: string;
  backup_enabled: boolean;
  backup_time: string;
  backup_interval: 'daily' | 'weekly' | 'monthly';
  retention_days: number;
  auto_delete_enabled: boolean;
  max_storage_bytes: number;
  warning_threshold_percent: number;
  created_at: string;
  updated_at: string;
}

export interface BackupStorageQuota {
  id: string;
  user_id: string;
  plan_type: 'basic' | 'standard' | 'premium' | 'unlimited';
  max_storage_bytes: number | null;
  current_usage_bytes: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface BackupNotification {
  id: string;
  user_id: string;
  backup_id: string | null;
  notification_type: 'success' | 'failure' | 'quota_warning' | 'quota_exceeded' | 'deletion_scheduled';
  message: string;
  notification_channel: 'email' | 'telegram' | 'in_app';
  sent_at: string;
  read_at: string | null;
  created_at: string;
}

export interface BackupMetrics {
  id: string;
  user_id: string;
  metric_date: string;
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  skipped_backups: number;
  total_size_bytes: number;
  average_duration_seconds: number;
  max_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

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

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface ApiResponseList<T> {
  data?: T[];
  count?: number;
  error?: string;
  status: number;
}

export interface CronResponse {
  triggered?: number;
  skipped?: number;
  failed?: number;
  deleted?: number;
  freed_bytes?: number;
  users_notified?: number;
  aggregated?: number;
  status: number;
}

export type NotificationType = 'success' | 'failure' | 'quota_warning' | 'quota_exceeded' | 'deletion_scheduled';
export type NotificationChannel = 'email' | 'telegram' | 'in_app';
