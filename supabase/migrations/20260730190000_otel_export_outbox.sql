create table if not exists public.otel_export_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  destination_id uuid not null references public.workspace_broadcast_destinations(id) on delete cascade,
  event_id text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_http_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (destination_id, event_id)
);

create index if not exists otel_export_outbox_pending_idx
  on public.otel_export_outbox (next_attempt_at, created_at)
  where status in ('pending', 'processing');

alter table public.otel_export_outbox enable row level security;

-- Trace payloads are backend-only. Keep the table inaccessible to browser roles
-- and opt the service role into Data API access explicitly.
revoke all on table public.otel_export_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.otel_export_outbox to service_role;

create or replace function public.claim_otel_export_outbox(p_limit integer default 100)
returns setof public.otel_export_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.otel_export_outbox
    where (
      status = 'pending'
      or (status = 'processing' and lease_expires_at < now())
    )
      and next_attempt_at <= now()
    order by next_attempt_at, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ),
  claimed as (
    update public.otel_export_outbox outbox
    set status = 'processing',
        attempts = attempts + 1,
        lease_expires_at = now() + interval '2 minutes',
        updated_at = now()
    from candidates
    where outbox.id = candidates.id
    returning outbox.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_otel_export_outbox(integer) from public;
grant execute on function public.claim_otel_export_outbox(integer) to service_role;
