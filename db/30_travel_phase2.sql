-- ────────────────────────────────────────────────────────────────────────
-- DSC FMS — Travel Phase 2: Checklist + Participants + Cost Splits
-- Adds: travel_checklist_items, travel_participants, travel_cost_splits
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Status: Idempotent (safe to re-run)
-- ────────────────────────────────────────────────────────────────────────

-- ── travel_checklist_items ──────────────────────────────────────────────
create table if not exists public.travel_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  travel_id     uuid not null references public.travel_records(id) on delete cascade,
  title         text not null,
  category      text default 'general'
    check (category in ('documents', 'packing', 'booking', 'health', 'general')),
  priority      text default 'medium'
    check (priority in ('low', 'medium', 'high')),
  description   text,
  is_done       boolean default false,
  done_at       timestamptz,
  sort_order    integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  created_by    uuid references auth.users(id)
);
create index if not exists idx_checklist_travel on public.travel_checklist_items(travel_id);

drop trigger if exists trg_checklist_updated_at on public.travel_checklist_items;
create trigger trg_checklist_updated_at
  before update on public.travel_checklist_items
  for each row execute function public.travel_set_updated_at();

-- ── travel_participants ─────────────────────────────────────────────────
-- Tracks multiple people on a single trip for cost-split calculations.
create table if not exists public.travel_participants (
  id            uuid primary key default gen_random_uuid(),
  travel_id     uuid not null references public.travel_records(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text not null,
  employee_id   text,
  role          text default 'member'
    check (role in ('organizer', 'member')),
  created_at    timestamptz default now()
);
create index if not exists idx_participant_travel on public.travel_participants(travel_id);
create unique index if not exists uniq_participant_travel_user
  on public.travel_participants(travel_id, user_id)
  where user_id is not null;

-- ── travel_cost_splits ──────────────────────────────────────────────────
-- One cost row can be split across N participants.
create table if not exists public.travel_cost_splits (
  id              uuid primary key default gen_random_uuid(),
  cost_id         uuid not null references public.travel_costs(id) on delete cascade,
  participant_id  uuid not null references public.travel_participants(id) on delete cascade,
  share_amount    decimal(12,2) not null,
  is_paid         boolean default false,
  paid_at         timestamptz,
  created_at      timestamptz default now()
);
create index if not exists idx_split_cost on public.travel_cost_splits(cost_id);
create index if not exists idx_split_participant on public.travel_cost_splits(participant_id);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.travel_checklist_items enable row level security;
alter table public.travel_participants    enable row level security;
alter table public.travel_cost_splits     enable row level security;

drop policy if exists checklist_all on public.travel_checklist_items;
create policy checklist_all on public.travel_checklist_items for all
  using (travel_id in (select id from public.travel_records where user_id = auth.uid()))
  with check (travel_id in (select id from public.travel_records where user_id = auth.uid()));

drop policy if exists participants_all on public.travel_participants;
create policy participants_all on public.travel_participants for all
  using (travel_id in (select id from public.travel_records where user_id = auth.uid()))
  with check (travel_id in (select id from public.travel_records where user_id = auth.uid()));

drop policy if exists cost_splits_all on public.travel_cost_splits;
create policy cost_splits_all on public.travel_cost_splits for all
  using (cost_id in (
    select c.id from public.travel_costs c
    join public.travel_records r on r.id = c.travel_id
    where r.user_id = auth.uid()
  ))
  with check (cost_id in (
    select c.id from public.travel_costs c
    join public.travel_records r on r.id = c.travel_id
    where r.user_id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────────────────
