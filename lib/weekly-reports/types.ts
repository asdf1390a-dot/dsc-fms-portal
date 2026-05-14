// DSC FMS Portal — Weekly Reports Phase 2 TypeScript types
// Companion to db/27_weekly_report_templates_entries.sql

export type WeeklyDept = 'production' | 'technology' | 'maintenance' | 'management';

export type WeeklyFieldType = 'number' | 'percent' | 'text' | 'longtext' | 'date';

export interface WeeklyTemplateField {
  key: string;
  label_ko: string;
  label_en: string;
  type: WeeklyFieldType;
  required?: boolean;
  unit?: string;
  /** 'manual' | 'auto:<rpc_key>' */
  source: string;
  default?: unknown;
}

export interface WeeklyReportTemplate {
  id: string;
  dept_name: WeeklyDept;
  version: number;
  name: string;
  description: string | null;
  fields: WeeklyTemplateField[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type WeeklyEntrySource = 'manual' | 'auto' | 'mixed';
export type WeeklyEntryStatus = 'draft' | 'submitted' | 'merged' | 'rejected';

export interface WeeklyReportEntry {
  id: string;
  year: number;
  week: number;
  dept_name: WeeklyDept;
  template_id: string | null;
  data: Record<string, unknown>;
  source: WeeklyEntrySource;
  status: WeeklyEntryStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  merged_into: string | null;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyEntryView extends WeeklyReportEntry {
  template_name: string | null;
  template_version: number | null;
  week_start_date: string;
  week_end_date: string;
}

export interface WeeklyReportRow {
  id: string;
  year: number;
  week: number;
  week_start_date: string;
  week_end_date: string;
  production: Record<string, unknown>;
  technology: Record<string, unknown>;
  maintenance: Record<string, unknown>;
  management: Record<string, unknown>;
  status: 'generated' | 'reviewed' | 'approved' | 'rejected';
  generated_by: string;
  reviewed_by: string | null;
  approved_by: string | null;
  generated_at: string;
  reviewed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Request/response payloads
export interface PostEntryRequest {
  year: number;
  week: number;
  dept_name: WeeklyDept;
  data: Record<string, unknown>;
  source?: WeeklyEntrySource;
  template_id?: string;
}

export interface PostAutoGenerateRequest {
  year?: number;
  week?: number;
  force?: boolean;
  seed_entries?: boolean;
}

export interface PostSubmitRequest {
  year: number;
  week: number;
  user_id?: string;
}

export interface HistoryQuery {
  year?: number;
  week?: number;
  dept_name?: WeeklyDept;
  status?: WeeklyEntryStatus;
  limit?: number;
  offset?: number;
}
