// Backup App Phase 2 — Type Definitions

// Schedule Policy
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
  updated_at: string;
}

export type ScheduleConfigureRequest = Partial<Omit<BackupPolicy, 'id' | 'user_id' | 'updated_at'>>;

export interface ScheduleConfigureResponse {
  success: true;
  policy: BackupPolicy;
}

export interface ScheduleTriggerRequest {
  name?: string;
}

export interface Backup {
  id: string;
  user_id: string;
  name: string;
  backup_type: 'agent_state' | 'full_export';
  status: 'in_progress' | 'completed' | 'failed';
  size_bytes?: number;
  created_at: string;
  created_by: string;
  metadata?: Record<string, any>;
}

export interface ScheduleTriggerResponse {
  success: true;
  backup: Pick<Backup, 'id' | 'user_id' | 'name' | 'backup_type' | 'status' | 'created_at'>;
}

export interface BackupInProgressError {
  error: 'Backup already in progress';
  in_progress_backup_id: string;
  started_at: string;
}

// Quota Management
export interface BackupStorageQuota {
  id: string;
  user_id: string;
  max_storage_bytes: number;
  plan_type: 'free' | 'standard' | 'premium';
  last_calculated_at: string;
}

export interface QuotaStatus {
  success: true;
  quota: {
    max_bytes: number;
    used_bytes: number;
    available_bytes: number;
    percentage: number;
    is_warning: boolean;
    is_exceeded: boolean;
    plan_type: string;
    last_calculated_at: string;
  };
}

export type QuotaUpdateRequest = Partial<Omit<BackupStorageQuota, 'id' | 'user_id' | 'last_calculated_at'>>;

// Metrics
export interface BackupMetric {
  id: string;
  user_id: string;
  date: string;
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  total_size_bytes: number;
  average_backup_time_ms: number;
  created_at: string;
}

export interface MetricsSummary {
  success: true;
  metrics: {
    total_backups: number;
    successful_backups: number;
    failed_backups: number;
    total_size_bytes: number;
    average_backup_time_ms: number;
    last_backup_at?: string;
    next_scheduled_at?: string;
  };
}

export interface MetricsDailyResponse {
  success: true;
  daily_metrics: BackupMetric[];
  period: {
    start_date: string;
    end_date: string;
  };
}

// Cleanup
export interface CleanupResult {
  success: true;
  deleted_backups: number;
  freed_bytes: number;
  timestamp: string;
}

// Notifications
export interface BackupNotification {
  id: string;
  user_id: string;
  type: 'backup_started' | 'backup_completed' | 'backup_failed' | 'quota_warning' | 'quota_exceeded';
  title: string;
  message: string;
  is_read: boolean;
  data?: Record<string, any>;
  created_at: string;
}

export interface NotificationListResponse {
  success: true;
  notifications: BackupNotification[];
  unread_count: number;
}

export interface NotificationReadResponse {
  success: true;
  notification: BackupNotification;
}

// Common Error Response
export interface ErrorResponse {
  error: string;
  [key: string]: any;
}
