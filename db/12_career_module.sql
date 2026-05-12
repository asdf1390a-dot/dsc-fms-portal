-- ────────────────────────────────────────────────────────────────────────
-- Career Workspace module — Phase 1 MVP
-- Tables: career_companies, career_projects, career_achievements,
--         career_profiles, career_skills
-- Run in Supabase SQL Editor.
-- ────────────────────────────────────────────────────────────────────────

-- ── updated_at trigger function ─────────────────────────────────────────
create or replace function public.career_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── career_companies ────────────────────────────────────────────────────
create table if not exists public.career_companies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  name_short      text,
  country         text default 'India',
  city            text,
  industry        text,
  logo_url        text,
  department      text,
  title           text,
  employment_type text default 'full_time' check (employment_type in
                    ('full_time','part_time','contract','internship','freelance')),
  start_date      date not null,
  end_date        date,
  is_current      boolean default false,
  is_public       boolean default false,
  sort_order      int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_career_companies_user on public.career_companies(user_id);
create index if not exists idx_career_companies_start on public.career_companies(start_date desc);

drop trigger if exists trg_career_companies_updated_at on public.career_companies;
create trigger trg_career_companies_updated_at
  before update on public.career_companies
  for each row execute function public.career_set_updated_at();

-- ── career_projects ─────────────────────────────────────────────────────
create table if not exists public.career_projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  company_id      uuid not null references public.career_companies(id) on delete cascade,
  title           text not null,
  summary         text,
  description     text,
  role            text,
  start_date      date,
  end_date        date,
  is_ongoing      boolean default false,
  category        text default 'improvement' check (category in
                    ('improvement','cost_reduction','quality','safety',
                     'digital','automation','other')),
  tags            text[] default '{}',
  kpi_label       text,
  kpi_value       text,
  kpi_detail      text,
  is_public       boolean default false,
  is_featured     boolean default false,
  fms_ref_type    text,
  fms_ref_ids     uuid[] default '{}',
  sort_order      int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_career_projects_user    on public.career_projects(user_id);
create index if not exists idx_career_projects_company on public.career_projects(company_id);
create index if not exists idx_career_projects_start   on public.career_projects(start_date desc);

drop trigger if exists trg_career_projects_updated_at on public.career_projects;
create trigger trg_career_projects_updated_at
  before update on public.career_projects
  for each row execute function public.career_set_updated_at();

-- ── career_achievements ─────────────────────────────────────────────────
create table if not exists public.career_achievements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  company_id       uuid not null references public.career_companies(id) on delete cascade,
  project_id       uuid references public.career_projects(id) on delete set null,
  title            text not null,
  detail           text,
  achieved_at      date,
  achievement_type text default 'improvement' check (achievement_type in
                     ('award','kpi_improvement','cost_reduction',
                      'process','certification','other')),
  metric_label     text,
  metric_before    text,
  metric_after     text,
  is_public        boolean default false,
  sort_order       int default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists idx_career_ach_user    on public.career_achievements(user_id);
create index if not exists idx_career_ach_company on public.career_achievements(company_id);
create index if not exists idx_career_ach_at      on public.career_achievements(achieved_at desc);

drop trigger if exists trg_career_ach_updated_at on public.career_achievements;
create trigger trg_career_ach_updated_at
  before update on public.career_achievements
  for each row execute function public.career_set_updated_at();

-- ── career_profiles ─────────────────────────────────────────────────────
create table if not exists public.career_profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  slug              text unique not null,
  display_name      text,
  headline          text,
  bio               text,
  avatar_url        text,
  contact_email     text,
  linkedin_url      text,
  github_url        text,
  is_public         boolean default false,
  pdf_generated_at  timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists idx_career_profiles_slug on public.career_profiles(slug);

drop trigger if exists trg_career_profiles_updated_at on public.career_profiles;
create trigger trg_career_profiles_updated_at
  before update on public.career_profiles
  for each row execute function public.career_set_updated_at();

-- ── career_skills ───────────────────────────────────────────────────────
create table if not exists public.career_skills (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  category     text default 'technical' check (category in
                 ('technical','management','language','domain','tool','other')),
  level        text default 'intermediate' check (level in
                 ('beginner','intermediate','advanced','expert')),
  company_ids  uuid[] default '{}',
  is_public    boolean default true,
  sort_order   int default 0,
  created_at   timestamptz default now(),
  unique (user_id, name)
);
create index if not exists idx_career_skills_user on public.career_skills(user_id);

-- ────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────
alter table public.career_companies    enable row level security;
alter table public.career_projects     enable row level security;
alter table public.career_achievements enable row level security;
alter table public.career_profiles     enable row level security;
alter table public.career_skills       enable row level security;

-- career_companies
drop policy if exists "companies_owner_all"  on public.career_companies;
drop policy if exists "companies_public_read" on public.career_companies;
create policy "companies_owner_all" on public.career_companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "companies_public_read" on public.career_companies
  for select using (is_public = true);

-- career_projects
drop policy if exists "projects_owner_all"   on public.career_projects;
drop policy if exists "projects_public_read" on public.career_projects;
create policy "projects_owner_all" on public.career_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_public_read" on public.career_projects
  for select using (is_public = true);

-- career_achievements
drop policy if exists "achievements_owner_all"   on public.career_achievements;
drop policy if exists "achievements_public_read" on public.career_achievements;
create policy "achievements_owner_all" on public.career_achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "achievements_public_read" on public.career_achievements
  for select using (is_public = true);

-- career_profiles
drop policy if exists "profiles_owner_all"   on public.career_profiles;
drop policy if exists "profiles_public_read" on public.career_profiles;
create policy "profiles_owner_all" on public.career_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_public_read" on public.career_profiles
  for select using (is_public = true);

-- career_skills
drop policy if exists "skills_owner_all"   on public.career_skills;
drop policy if exists "skills_public_read" on public.career_skills;
create policy "skills_owner_all" on public.career_skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "skills_public_read" on public.career_skills
  for select using (is_public = true);
