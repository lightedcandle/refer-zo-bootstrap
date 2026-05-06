create extension if not exists pgcrypto;

create table if not exists public.alliance_sms_outbox (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  message text not null,
  status text not null default 'queued',
  queued_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alliance_sms_inbox (
  id uuid primary key default gen_random_uuid(),
  from_phone text not null,
  body text not null,
  message_date bigint,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alliance_sms_delivery_events (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references public.alliance_sms_outbox(id) on delete set null,
  status text not null,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists alliance_sms_outbox_set_updated_at on public.alliance_sms_outbox;
create trigger alliance_sms_outbox_set_updated_at
before update on public.alliance_sms_outbox
for each row
execute function public.alliance_set_updated_at();

alter table public.alliance_sms_outbox enable row level security;
alter table public.alliance_sms_inbox enable row level security;
alter table public.alliance_sms_delivery_events enable row level security;

revoke all on public.alliance_sms_outbox from anon, authenticated;
revoke all on public.alliance_sms_inbox from anon, authenticated;
revoke all on public.alliance_sms_delivery_events from anon, authenticated;

grant all on public.alliance_sms_outbox to service_role;
grant all on public.alliance_sms_inbox to service_role;
grant all on public.alliance_sms_delivery_events to service_role;

create index if not exists alliance_sms_outbox_status_queued_idx
on public.alliance_sms_outbox(status, queued_at);

create index if not exists alliance_sms_inbox_from_date_idx
on public.alliance_sms_inbox(from_phone, message_date desc);

create index if not exists alliance_sms_delivery_outbox_idx
on public.alliance_sms_delivery_events(outbox_id, created_at desc);

