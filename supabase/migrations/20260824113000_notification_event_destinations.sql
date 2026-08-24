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
