-- phaseo:allow-destructive-migration reason: the setter atomically replaces only one workspace alert's routing rows after an administrator saves that alert
create table if not exists public.notification_event_destinations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_kind text not null check (event_kind in ('low_balance', 'auto_top_up_failed', 'payment_method_expiring', 'model_deprecation')),
  destination_id uuid not null references public.notification_destinations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, event_kind, destination_id)
);

create index if not exists notification_event_destinations_destination_idx
  on public.notification_event_destinations (destination_id);

alter table public.notification_event_destinations enable row level security;
revoke all on table public.notification_event_destinations from anon, authenticated;
grant select, insert, update, delete on public.notification_event_destinations to service_role;

create table if not exists public.notification_routed_events (
  event_id uuid primary key references public.email_outbox(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  routed_at timestamptz not null default now()
);

create index if not exists notification_routed_events_workspace_idx
  on public.notification_routed_events (workspace_id, routed_at desc);

alter table public.notification_routed_events enable row level security;
revoke all on table public.notification_routed_events from anon, authenticated;
grant select, insert, update, delete on public.notification_routed_events to service_role;

create or replace function public.set_notification_event_destinations(
  p_workspace_id uuid,
  p_event_kind text,
  p_destination_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || p_event_kind, 0));

  if p_event_kind not in ('low_balance', 'auto_top_up_failed', 'payment_method_expiring', 'model_deprecation') then
    raise exception 'invalid_notification_event_kind';
  end if;

  if (
    select count(*)
    from public.notification_destinations
    where workspace_id = p_workspace_id
      and status = 'active'
      and id = any(p_destination_ids)
  ) <> cardinality(p_destination_ids) then
    raise exception 'notification_destination_not_found';
  end if;

  delete from public.notification_event_destinations
  where workspace_id = p_workspace_id and event_kind = p_event_kind;

  insert into public.notification_event_destinations (workspace_id, event_kind, destination_id)
  select p_workspace_id, p_event_kind, destination_id
  from unnest(p_destination_ids) as destination_id;
end;
$$;

revoke all on function public.set_notification_event_destinations(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.set_notification_event_destinations(uuid, text, uuid[]) to service_role;

create or replace function public.enqueue_notification_event_deliveries(
  p_event_id uuid,
  p_workspace_id uuid,
  p_event_kind text,
  p_requested_destination_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_event_id uuid;
  inserted_count integer := 0;
begin
  insert into public.notification_routed_events (event_id, workspace_id)
  values (p_event_id, p_workspace_id)
  on conflict (event_id) do nothing
  returning event_id into claimed_event_id;

  if claimed_event_id is null then
    return 0;
  end if;

  if p_event_kind = 'notification_test' and p_requested_destination_id is not null then
    insert into public.notification_delivery_attempts (event_id, destination_id, workspace_id, status)
    select p_event_id, destination.id, p_workspace_id, 'pending'
    from public.notification_destinations destination
    where destination.id = p_requested_destination_id
      and destination.workspace_id = p_workspace_id
      and destination.status = 'active'
    on conflict (event_id, destination_id) do nothing;
  else
    insert into public.notification_delivery_attempts (event_id, destination_id, workspace_id, status)
    select p_event_id, route.destination_id, p_workspace_id, 'pending'
    from public.notification_event_destinations route
    join public.notification_destinations destination on destination.id = route.destination_id
    where route.workspace_id = p_workspace_id
      and route.event_kind = p_event_kind
      and destination.status = 'active'
    on conflict (event_id, destination_id) do nothing;
  end if;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_notification_event_deliveries(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_notification_event_deliveries(uuid, uuid, text, uuid) to service_role;

-- Events created before per-alert routing already used the previous global routing
-- behavior. Mark them as snapshotted so a later route edit cannot replay them.
insert into public.notification_routed_events (event_id, workspace_id)
select event.id, event.workspace_id
from public.email_outbox event
where event.workspace_id is not null
  and event.kind in ('low_balance', 'auto_top_up_failed', 'payment_method_expiring', 'model_deprecation', 'notification_test')
on conflict (event_id) do nothing;

-- Preserve the original workspace-wide fan-out until an administrator customizes
-- each alert. New destinations are intentionally not selected automatically.
insert into public.notification_event_destinations (workspace_id, event_kind, destination_id)
select destination.workspace_id, event_kind.kind, destination.id
from public.notification_destinations destination
cross join (values
  ('low_balance'),
  ('auto_top_up_failed'),
  ('payment_method_expiring'),
  ('model_deprecation')
) as event_kind(kind)
where destination.status = 'active'
  and destination.is_ephemeral = false
on conflict do nothing;

comment on table public.notification_event_destinations is
  'Per-alert routing from workspace notification event kinds to reusable destinations.';
comment on table public.notification_routed_events is
  'Marks notification events after their destination routing has been snapshotted exactly once.';
