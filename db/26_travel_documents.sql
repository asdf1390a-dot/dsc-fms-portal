-- ────────────────────────────────────────────────────────────────────────
-- Travel Module — Documents table (Phase 1 completion)
-- Depends on: 21_travel_module.sql
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Status: Idempotent
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.travel_documents (
  id              uuid primary key default gen_random_uuid(),
  travel_id       uuid not null references public.travel_records(id) on delete cascade,

  -- Document
  doc_type        text not null
    check (doc_type in ('passport','visa','ticket','insurance','itinerary','receipt','other')),
  title           text not null,
  description     text,

  -- File (Supabase Storage)
  file_url        text,
  file_name       text,
  file_size       integer,
  mime_type       text,

  -- Lifecycle dates
  issued_on       date,
  expires_on      date,

  -- Audit
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists idx_travel_doc_travel  on public.travel_documents(travel_id);
create index if not exists idx_travel_doc_type    on public.travel_documents(doc_type);
create index if not exists idx_travel_doc_expires on public.travel_documents(expires_on);

drop trigger if exists trg_travel_doc_updated_at on public.travel_documents;
create trigger trg_travel_doc_updated_at
  before update on public.travel_documents
  for each row execute function public.travel_set_updated_at();

-- RLS
alter table public.travel_documents enable row level security;

drop policy if exists travel_doc_all on public.travel_documents;
create policy travel_doc_all on public.travel_documents for all
  using (travel_id in (
    select id from public.travel_records where user_id = auth.uid()
  ))
  with check (travel_id in (
    select id from public.travel_records where user_id = auth.uid()
  ));
