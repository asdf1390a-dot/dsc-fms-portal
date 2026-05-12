-- 18_management_reports.sql
-- 경영실적 월별 보고 데이터
-- 입력: production / quality / weekly_tasks (jsonb)
-- 산출: file_status (Excel/PPT 생성 메타), source_file (원본 1번 파일 메타)

create table if not exists management_reports (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),

  -- 생산성 (계획/실적, 가동률, OEE, 인원, 인당매출 등)
  production jsonb default '{}'::jsonb,
  -- 품질지수 (고객/공정/입고 불량, 클레임비, 폐기비, 매출액 등)
  quality jsonb default '{}'::jsonb,
  -- 주간업무 ([{week: 1, content: "..."}, ...])
  weekly_tasks jsonb default '[]'::jsonb,

  -- 파일 생성 상태 {excel: {generated_at, filename}, ppt: {...}}
  file_status jsonb default '{"excel": null, "ppt": null}'::jsonb,
  -- 업로드된 1번 파일 메타 {filename, size, uploaded_at}
  source_file jsonb default null,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (year, month)
);

create index if not exists idx_mgmt_reports_year_month
  on management_reports (year desc, month desc);

-- updated_at 자동 갱신 트리거
create or replace function update_management_reports_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_management_reports_updated_at on management_reports;
create trigger trg_management_reports_updated_at
  before update on management_reports
  for each row execute function update_management_reports_updated_at();

-- RLS: anon 읽기 / authenticated 쓰기
alter table management_reports enable row level security;

drop policy if exists mgmt_reports_select on management_reports;
create policy mgmt_reports_select on management_reports
  for select using (true);

drop policy if exists mgmt_reports_insert on management_reports;
create policy mgmt_reports_insert on management_reports
  for insert with check (auth.role() = 'authenticated');

drop policy if exists mgmt_reports_update on management_reports;
create policy mgmt_reports_update on management_reports
  for update using (auth.role() = 'authenticated');

drop policy if exists mgmt_reports_delete on management_reports;
create policy mgmt_reports_delete on management_reports
  for delete using (auth.role() = 'authenticated');
