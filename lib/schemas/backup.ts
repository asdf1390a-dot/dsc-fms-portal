import { z } from 'zod';

// Schedule Configuration
export const ScheduleConfigureRequestSchema = z.object({
  enabled: z.boolean().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  interval: z.enum(['daily', 'weekly', 'monthly']).optional(),
  retention_days: z.number().min(7).max(3650, 'Retention days must be 7-3650').optional(),
  auto_delete_enabled: z.boolean().optional(),
  max_storage_bytes: z.number().min(1073741824).optional(), // 1GB min
  warning_threshold_percent: z.number().min(1).max(100).optional()
});

export type ScheduleConfigureRequest = z.infer<typeof ScheduleConfigureRequestSchema>;

// Schedule Trigger
export const ScheduleTriggerRequestSchema = z.object({
  name: z.string().max(255).optional()
});

export type ScheduleTriggerRequest = z.infer<typeof ScheduleTriggerRequestSchema>;

// Quota Update
export const QuotaUpdateRequestSchema = z.object({
  max_storage_bytes: z.number().min(1073741824).optional(), // 1GB min
  plan_type: z.enum(['free', 'standard', 'premium']).optional()
});

export type QuotaUpdateRequest = z.infer<typeof QuotaUpdateRequestSchema>;

// Metrics Query
export const MetricsDailyQuerySchema = z.object({
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  limit: z.number().min(1).max(365).optional()
});

export type MetricsDailyQuery = z.infer<typeof MetricsDailyQuerySchema>;

// Cleanup Query
export const CleanupQuerySchema = z.object({
  include_failed: z.boolean().optional(),
  min_age_days: z.number().min(1).optional()
});

export type CleanupQuery = z.infer<typeof CleanupQuerySchema>;

// Notification List Query
export const NotificationListQuerySchema = z.object({
  type: z.enum(['backup_started', 'backup_completed', 'backup_failed', 'quota_warning', 'quota_exceeded']).optional(),
  is_read: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

// Notification Read
export const NotificationReadRequestSchema = z.object({
  id: z.string().uuid('Invalid notification ID')
});

export type NotificationReadRequest = z.infer<typeof NotificationReadRequestSchema>;
