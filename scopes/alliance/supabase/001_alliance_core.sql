create extension if not exists pgcrypto;

create table if not exists public.alliance_records (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  label text,
  route text,
  local_dataset text,
  values jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alliance_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  record_id uuid references public.alliance_records(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.alliance_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alliance_records_set_updated_at on public.alliance_records;
create trigger alliance_records_set_updated_at
before update on public.alliance_records
for each row
execute function public.alliance_set_updated_at();

alter table public.alliance_records enable row level security;
alter table public.alliance_audit_events enable row level security;

grant select, insert, update on public.alliance_records to authenticated;
grant select, insert on public.alliance_audit_events to authenticated;
grant all on public.alliance_records to service_role;
grant all on public.alliance_audit_events to service_role;

drop policy if exists alliance_records_authenticated_select_own on public.alliance_records;
create policy alliance_records_authenticated_select_own
on public.alliance_records
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists alliance_records_authenticated_insert_own on public.alliance_records;
create policy alliance_records_authenticated_insert_own
on public.alliance_records
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists alliance_records_authenticated_update_own on public.alliance_records;
create policy alliance_records_authenticated_update_own
on public.alliance_records
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists alliance_audit_authenticated_select_own on public.alliance_audit_events;
create policy alliance_audit_authenticated_select_own
on public.alliance_audit_events
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists alliance_audit_authenticated_insert_own on public.alliance_audit_events;
create policy alliance_audit_authenticated_insert_own
on public.alliance_audit_events
for insert
to authenticated
with check (created_by = auth.uid());

create index if not exists alliance_records_entity_idx on public.alliance_records(entity);
create index if not exists alliance_records_local_dataset_idx on public.alliance_records(local_dataset);
create index if not exists alliance_records_created_at_idx on public.alliance_records(created_at desc);
create index if not exists alliance_audit_record_idx on public.alliance_audit_events(record_id);
