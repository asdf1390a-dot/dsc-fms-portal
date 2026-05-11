-- ============================================================================
-- DSC FMS Portal — KPI RPC functions
-- 적용: Supabase Dashboard → SQL Editor → 붙여넣기 → Run
-- ============================================================================
-- Three RPC functions callable via supabase.rpc() from the client:
--   1. get_monthly_kpi(target_month text)
--      → Aggregated MTTR / MTBF / breakdown counts for a given month.
--   2. get_breakdown_by_status(from_date timestamptz, to_date timestamptz)
--      → Breakdown counts grouped by status for a date range.
--   3. get_cause_distribution(from_date timestamptz, to_date timestamptz)
--      → Cause-group distribution (count + percentage) for a date range.
--
-- All functions use SECURITY DEFINER so anon clients can read aggregated KPI
-- data without exposing row-level access to the underlying tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Monthly KPI aggregate
-- ----------------------------------------------------------------------------
create or replace function get_monthly_kpi(target_month text default to_char(now(), 'YYYY-MM-01'))
returns table (
  mttr_min numeric,
  mtbf_min numeric,
  total_breakdowns bigint,
  total_downtime_min numeric
) language sql security definer as $$
  select
    round(
      sum(mttr_min * breakdown_count) / nullif(sum(breakdown_count), 0)
    , 1) as mttr_min,
    round(avg(mtbf_min), 1) as mtbf_min,
    sum(breakdown_count) as total_breakdowns,
    sum(total_downtime_min) as total_downtime_min
  from bm_kpi
  where month = date_trunc('month', target_month::timestamptz);
$$;

-- ----------------------------------------------------------------------------
-- 2. Breakdown counts by status (current month default)
-- ----------------------------------------------------------------------------
create or replace function get_breakdown_by_status(
  from_date timestamptz default date_trunc('month', now()),
  to_date   timestamptz default date_trunc('month', now()) + interval '1 month'
)
returns table (status text, cnt bigint)
language sql security definer as $$
  select status, count(*) as cnt
  from bm_events
  where reported_at >= from_date and reported_at < to_date
  group by status
  order by cnt desc;
$$;

-- ----------------------------------------------------------------------------
-- 3. Cause-group distribution (count + percent) for a date range
-- ----------------------------------------------------------------------------
create or replace function get_cause_distribution(
  from_date timestamptz default date_trunc('month', now()),
  to_date   timestamptz default date_trunc('month', now()) + interval '1 month'
)
returns table (group_name text, cnt bigint, pct numeric)
language sql security definer as $$
  with base as (
    select cc.group_name, count(*) as cnt
    from bm_events b
    left join cause_codes cc on cc.code = b.cause_code
    where b.reported_at >= from_date and b.reported_at < to_date
    group by cc.group_name
  ),
  total as (select sum(cnt) as t from base)
  select
    coalesce(b.group_name, 'Unknown') as group_name,
    b.cnt,
    round(b.cnt * 100.0 / nullif(t.t, 0), 1) as pct
  from base b, total t
  order by b.cnt desc;
$$;
