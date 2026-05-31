// lib/hooks/useBreakdowns.ts
// BM-P1 Phase 2 — Data fetching hooks for breakdown management.
// Wires UI components to /api/bm/breakdowns* endpoints (delivered by M1).
//
// Falls back to mock data when the API endpoint is unreachable (501/404),
// so the UI can be developed in parallel with M1.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

// ── Types ───────────────────────────────────────────────────────────
export type BreakdownStatus =
  | 'reported'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'won_fix';

export type BreakdownSeverity = 'minor' | 'normal' | 'major' | 'line_down';

export type BreakdownCategory =
  | 'mechanical'
  | 'electrical'
  | 'hydraulic'
  | 'software'
  | 'operator_error'
  | 'unknown';

export interface BreakdownReport {
  id: string;
  asset_id: string;
  machine_asset_number?: string | null;
  asset_name?: string | null;
  status: BreakdownStatus;
  severity: BreakdownSeverity;
  category?: BreakdownCategory | null;
  description: string;
  description_ta?: string | null;
  started_at?: string | null;
  resolved_at?: string | null;
  reported_at: string;
  acknowledged_at?: string | null;
  duration_minutes?: number | null;
  reported_by?: string | null;
  reporter_name?: string | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
  resolved_by?: string | null;
  resolver_name?: string | null;
  root_cause?: string | null;
  action_taken?: string | null;
  photos?: string[];
  documents?: string[];
  created_at: string;
  updated_at?: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ListFilters {
  asset_id?: string;
  status?: BreakdownStatus[];
  severity?: BreakdownSeverity[];
  reported_from?: string;
  reported_to?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AnalyticsSummary {
  asset_id: string;
  machine_asset_number: string;
  asset_name: string;
  month: string;
  summary: {
    total_breakdowns: number;
    resolved_count: number;
    open_count: number;
    resolution_rate: number;
  };
  severity_distribution: {
    line_down: number;
    major: number;
    normal: number;
    minor: number;
  };
  performance_metrics: {
    avg_mttr_minutes: number | null;
    avg_mtbf_hours: number | null;
    total_downtime_minutes: number;
  };
}

export interface OverallMetrics {
  total_breakdowns: number;
  resolved_count: number;
  open_count: number;
  resolution_rate: number;
  severity_distribution: {
    line_down: number;
    major: number;
    normal: number;
    minor: number;
  };
  total_downtime_minutes: number;
  avg_mttr_minutes?: number | null;
  avg_mtbf_hours?: number | null;
}

// ── Helpers ─────────────────────────────────────────────────────────
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function qs(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      u.set(k, v.join(','));
    } else {
      u.set(k, String(v));
    }
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

async function safeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const r = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await r.json() : await r.text();
  if (!r.ok) {
    const msg = (body && typeof body === 'object' && 'error' in body)
      ? (body as { error: string }).error
      : (typeof body === 'string' ? body : `HTTP ${r.status}`);
    const err = new Error(msg) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return body as T;
}

// Fallback: read directly from Supabase bm_events table if the new
// /api/bm/breakdowns endpoint is not yet deployed (M1 still in flight).
async function fallbackListFromSupabase(filters: ListFilters) {
  let q = supabase
    .from('bm_events')
    .select(
      'id, asset_id, status, severity, symptom, reported_at, resolved_at, reporter_name, ' +
        'assets(machine_asset_number, name_en)',
      { count: 'exact' }
    );
  if (filters.asset_id) q = q.eq('asset_id', filters.asset_id);
  if (filters.status && filters.status.length) q = q.in('status', filters.status as string[]);
  if (filters.severity && filters.severity.length) q = q.in('severity', filters.severity as string[]);
  if (filters.reported_from) q = q.gte('reported_at', filters.reported_from);
  if (filters.reported_to) q = q.lte('reported_at', filters.reported_to);
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  q = q
    .order(filters.sort_by || 'reported_at', { ascending: filters.sort_dir === 'asc' })
    .range(offset, offset + limit - 1);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows: BreakdownReport[] = (data || []).map((r: any) => ({
    id: r.id,
    asset_id: r.asset_id,
    machine_asset_number: r.assets?.machine_asset_number || null,
    asset_name: r.assets?.name_en || null,
    status: r.status,
    severity: r.severity,
    description: r.symptom || '',
    reported_at: r.reported_at,
    resolved_at: r.resolved_at,
    reporter_name: r.reporter_name,
    created_at: r.reported_at,
    duration_minutes:
      r.resolved_at && r.reported_at
        ? Math.max(0, Math.round((new Date(r.resolved_at).getTime() - new Date(r.reported_at).getTime()) / 60000))
        : null,
    photos: [],
    documents: [],
  }));
  return {
    data: rows,
    pagination: {
      total: count ?? rows.length,
      limit,
      offset,
      has_more: rows.length === limit,
    } as PaginationInfo,
  };
}

// ── Hooks ───────────────────────────────────────────────────────────
export function useBreakdowns(filters: ListFilters) {
  const [data, setData] = useState<BreakdownReport[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Stable JSON key for dependency array.
  const key = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const url = `/api/bm/breakdowns${qs(filters as Record<string, unknown>)}`;
        try {
          const res = await safeFetch<{ data: BreakdownReport[]; pagination: PaginationInfo }>(url);
          if (cancelled) return;
          setData(res.data || []);
          setPagination(res.pagination || null);
        } catch (e: any) {
          // Endpoint not yet available — fall back to direct Supabase read.
          if (e?.status === 404 || e?.status === 501 || !e?.status) {
            const res = await fallbackListFromSupabase(filters);
            if (cancelled) return;
            setData(res.data);
            setPagination(res.pagination);
          } else {
            throw e;
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshCount]);

  const refresh = useCallback(() => setRefreshCount((c) => c + 1), []);
  return { data, pagination, loading, error, refresh };
}

export function useBreakdownById(id: string | undefined) {
  const [data, setData] = useState<BreakdownReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        try {
          const res = await safeFetch<BreakdownReport>(`/api/bm/breakdowns/${id}`);
          if (cancelled) return;
          setData(res);
        } catch (e: any) {
          if (e?.status === 404 || e?.status === 501 || !e?.status) {
            // Fall back to direct Supabase read on bm_events table.
            const { data: row, error: sbErr } = await supabase
              .from('bm_events')
              .select('*, assets(machine_asset_number, name_en, location)')
              .eq('id', id)
              .maybeSingle();
            if (sbErr) throw new Error(sbErr.message);
            if (!row) throw new Error('Breakdown not found');
            if (cancelled) return;
            setData({
              id: row.id,
              asset_id: row.asset_id,
              machine_asset_number: row.assets?.machine_asset_number || null,
              asset_name: row.assets?.name_en || null,
              status: row.status,
              severity: row.severity,
              category: row.category || null,
              description: row.symptom || row.description || '',
              description_ta: row.description_ta || null,
              started_at: row.started_at || row.reported_at,
              resolved_at: row.resolved_at,
              reported_at: row.reported_at,
              acknowledged_at: row.acknowledged_at || null,
              duration_minutes:
                row.resolved_at && row.reported_at
                  ? Math.max(
                      0,
                      Math.round(
                        (new Date(row.resolved_at).getTime() - new Date(row.reported_at).getTime()) /
                          60000
                      )
                    )
                  : null,
              reporter_name: row.reporter_name,
              reported_by: row.reported_by || row.created_by || null,
              assigned_to: row.assigned_to || null,
              resolved_by: row.resolved_by || null,
              root_cause: row.root_cause || null,
              action_taken: row.action_taken || row.resolution_note || null,
              photos: Array.isArray(row.photos) ? row.photos : [],
              documents: Array.isArray(row.documents) ? row.documents : [],
              created_at: row.created_at || row.reported_at,
              updated_at: row.updated_at,
            });
          } else {
            throw e;
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, refreshCount]);

  const refresh = useCallback(() => setRefreshCount((c) => c + 1), []);
  return { data, loading, error, refresh };
}

export function useBreakdownAnalytics(params: {
  asset_id?: string;
  month?: string;
  reported_from?: string;
  reported_to?: string;
  limit?: number;
  offset?: number;
}) {
  const [data, setData] = useState<AnalyticsSummary[]>([]);
  const [overall, setOverall] = useState<OverallMetrics | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const url = `/api/bm/breakdowns/analytics/summary${qs(params as Record<string, unknown>)}`;
        try {
          const res = await safeFetch<{
            data: AnalyticsSummary[];
            overall_metrics: OverallMetrics | null;
            pagination: PaginationInfo;
          }>(url);
          if (cancelled) return;
          setData(res.data || []);
          setOverall(res.overall_metrics || null);
          setPagination(res.pagination || null);
        } catch (e: any) {
          if (e?.status === 404 || e?.status === 501 || !e?.status) {
            // Client-side fallback aggregation.
            const fallback = await fallbackAnalytics(params);
            if (cancelled) return;
            setData(fallback.data);
            setOverall(fallback.overall);
            setPagination(fallback.pagination);
          } else {
            throw e;
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, overall, pagination, loading, error };
}

async function fallbackAnalytics(params: {
  asset_id?: string;
  reported_from?: string;
  reported_to?: string;
}) {
  let q = supabase
    .from('bm_events')
    .select('id, asset_id, status, severity, reported_at, resolved_at, assets(machine_asset_number, name_en)')
    .limit(2000);
  if (params.asset_id) q = q.eq('asset_id', params.asset_id);
  if (params.reported_from) q = q.gte('reported_at', params.reported_from);
  if (params.reported_to) q = q.lte('reported_at', params.reported_to);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    asset_id: string;
    status: string;
    severity: BreakdownSeverity;
    reported_at: string;
    resolved_at: string | null;
    assets: { machine_asset_number?: string; name_en?: string } | null;
  };
  const all = (rows || []) as unknown as Row[];

  // Group by asset + month.
  const buckets: Record<string, AnalyticsSummary> = {};
  for (const r of all) {
    const monthKey = (r.reported_at || '').slice(0, 7) + '-01';
    const key = `${r.asset_id}__${monthKey}`;
    if (!buckets[key]) {
      buckets[key] = {
        asset_id: r.asset_id,
        machine_asset_number: r.assets?.machine_asset_number || '',
        asset_name: r.assets?.name_en || '',
        month: monthKey,
        summary: { total_breakdowns: 0, resolved_count: 0, open_count: 0, resolution_rate: 0 },
        severity_distribution: { line_down: 0, major: 0, normal: 0, minor: 0 },
        performance_metrics: { avg_mttr_minutes: null, avg_mtbf_hours: null, total_downtime_minutes: 0 },
      };
    }
    const b = buckets[key];
    b.summary.total_breakdowns++;
    if (r.status === 'resolved') b.summary.resolved_count++;
    else b.summary.open_count++;
    const sev = r.severity in b.severity_distribution ? r.severity : 'normal';
    (b.severity_distribution as Record<string, number>)[sev]++;
    if (r.resolved_at) {
      const dur = Math.round((new Date(r.resolved_at).getTime() - new Date(r.reported_at).getTime()) / 60000);
      if (dur > 0) b.performance_metrics.total_downtime_minutes += dur;
    }
  }
  for (const b of Object.values(buckets)) {
    b.summary.resolution_rate =
      b.summary.total_breakdowns > 0
        ? Math.round((b.summary.resolved_count / b.summary.total_breakdowns) * 100)
        : 0;
    const resolvedDur = b.performance_metrics.total_downtime_minutes;
    b.performance_metrics.avg_mttr_minutes =
      b.summary.resolved_count > 0 ? Math.round(resolvedDur / b.summary.resolved_count) : null;
  }
  const data = Object.values(buckets).sort((a, b) => (a.month < b.month ? 1 : -1));

  // Overall metrics
  const overall: OverallMetrics = {
    total_breakdowns: all.length,
    resolved_count: all.filter((r) => r.status === 'resolved').length,
    open_count: all.filter((r) => r.status !== 'resolved').length,
    resolution_rate: 0,
    severity_distribution: { line_down: 0, major: 0, normal: 0, minor: 0 },
    total_downtime_minutes: 0,
    avg_mttr_minutes: null,
    avg_mtbf_hours: null,
  };
  for (const r of all) {
    const sev = r.severity in overall.severity_distribution ? r.severity : 'normal';
    (overall.severity_distribution as Record<string, number>)[sev]++;
    if (r.resolved_at) {
      const dur = Math.round(
        (new Date(r.resolved_at).getTime() - new Date(r.reported_at).getTime()) / 60000
      );
      if (dur > 0) overall.total_downtime_minutes += dur;
    }
  }
  overall.resolution_rate =
    overall.total_breakdowns > 0
      ? Math.round((overall.resolved_count / overall.total_breakdowns) * 100)
      : 0;
  overall.avg_mttr_minutes =
    overall.resolved_count > 0 ? Math.round(overall.total_downtime_minutes / overall.resolved_count) : null;

  return {
    data,
    overall,
    pagination: { total: data.length, limit: data.length, offset: 0, has_more: false } as PaginationInfo,
  };
}

// ── Mutation helpers ────────────────────────────────────────────────
export interface CreateBreakdownInput {
  asset_id: string;
  description: string;
  description_ta?: string;
  severity?: BreakdownSeverity;
  category?: BreakdownCategory;
  started_at?: string;
  photos?: string[];
  documents?: string[];
}

export async function createBreakdown(input: CreateBreakdownInput): Promise<BreakdownReport> {
  return safeFetch<BreakdownReport>('/api/bm/breakdowns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateBreakdownInput {
  status?: BreakdownStatus;
  severity?: BreakdownSeverity;
  category?: BreakdownCategory | null;
  assigned_to?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  root_cause?: string | null;
  action_taken?: string | null;
  photos?: string[];
  documents?: string[];
}

export async function updateBreakdown(
  id: string,
  input: UpdateBreakdownInput
): Promise<BreakdownReport> {
  return safeFetch<BreakdownReport>(`/api/bm/breakdowns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteBreakdown(id: string): Promise<void> {
  await safeFetch<{ ok: boolean }>(`/api/bm/breakdowns/${id}`, { method: 'DELETE' });
}

// Asset picker helper — searches the assets table.
export async function searchAssets(query: string, limit = 20) {
  let q = supabase
    .from('assets')
    .select('id, machine_asset_number, name_en, location')
    .order('machine_asset_number', { ascending: true })
    .limit(limit);
  if (query && query.trim()) {
    const like = `%${query.trim()}%`;
    q = q.or(`machine_asset_number.ilike.${like},name_en.ilike.${like}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as Array<{
    id: string;
    machine_asset_number: string;
    name_en: string | null;
    location: string | null;
  }>;
}

// Valid status transitions enforced client-side.
export const VALID_STATUS_TRANSITIONS: Record<BreakdownStatus, BreakdownStatus[]> = {
  reported: ['acknowledged', 'won_fix'],
  acknowledged: ['in_progress', 'won_fix'],
  in_progress: ['resolved', 'won_fix'],
  resolved: [],
  won_fix: [],
};

// Shared display constants ------------------------------------------
export const STATUS_COLORS: Record<BreakdownStatus, { bg: string; fg: string; border: string; label: string }> = {
  reported:     { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)', label: 'REPORTED' },
  acknowledged: { bg: 'rgba(37,99,235,0.18)',  fg: '#93c5fd', border: 'rgba(37,99,235,0.6)',  label: 'ACK' },
  in_progress:  { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)', label: 'IN PROGRESS' },
  resolved:     { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)',  label: 'RESOLVED' },
  won_fix:      { bg: 'rgba(37,99,235,0.18)',  fg: '#93c5fd', border: 'rgba(37,99,235,0.6)',  label: "WON'T FIX" },
};

export const SEVERITY_COLORS: Record<BreakdownSeverity, { bg: string; fg: string; border: string; label: string }> = {
  minor:     { bg: 'rgba(6,182,212,0.18)',  fg: '#67e8f9', border: 'rgba(6,182,212,0.6)',  label: 'MINOR' },
  normal:    { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)', label: 'NORMAL' },
  major:     { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)', label: 'MAJOR' },
  line_down: { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)',  label: 'LINE DOWN' },
};
