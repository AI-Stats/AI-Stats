-- Retain established maintenance RPC signatures while routing all refresh work
-- through the V2 analytics outbox and processor.
create or replace function public.refresh_v2_analytics_range(
  p_since timestamptz,
  p_until timestamptz default now(),
  p_workspace_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  insert into public.v2_analytics_outbox (
    request_event_id, workspace_id, occurred_at, status,
    attempt_count, available_at, last_error, updated_at
  )
  select
    fact.request_event_id, fact.workspace_id, fact.occurred_at, 'pending',
    0, now(), null, now()
  from public.v2_request_facts fact
  where fact.occurred_at >= coalesce(p_since, '-infinity'::timestamptz)
    and fact.occurred_at < coalesce(p_until, 'infinity'::timestamptz)
    and (p_workspace_id is null or fact.workspace_id = p_workspace_id)
  on conflict (request_event_id) do update set
    status = 'pending',
    attempt_count = 0,
    available_at = now(),
    last_error = null,
    updated_at = now();

  loop
    result := public.process_v2_analytics_outbox(2000);
    exit when coalesce((result->>'selected')::integer, 0) = 0;
  end loop;
end;
$$;

create or replace function public.refresh_gateway_usage_rollups(
  p_since timestamptz default now() - interval '3 hours'
)
returns void language sql security definer set search_path = '' as $$
  select public.refresh_v2_analytics_range(p_since, now(), null);
$$;

create or replace function public.refresh_gateway_usage_rollups_workspace_scope(
  p_since timestamptz default now() - interval '3 hours'
)
returns void language sql security definer set search_path = '' as $$
  select public.refresh_v2_analytics_range(p_since, now(), null);
$$;

create or replace function public.refresh_gateway_activity_rollup_daily(
  p_workspace_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns void language sql security definer set search_path = '' as $$
  select public.refresh_v2_analytics_range(p_start, p_end, p_workspace_id);
$$;

create or replace function public.refresh_gateway_model_usage_daily(
  p_since timestamptz default now() - interval '90 days',
  p_until timestamptz default now()
)
returns void language sql security definer set search_path = '' as $$
  select public.refresh_v2_analytics_range(p_since, p_until, null);
$$;

create or replace function public.refresh_public_leaderboard_rollups(
  p_since timestamptz default now() - interval '90 days',
  p_until timestamptz default now()
)
returns void language sql security definer set search_path = '' as $$
  select public.refresh_v2_analytics_range(p_since, p_until, null);
$$;

revoke all on function public.refresh_v2_analytics_range(timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.refresh_v2_analytics_range(timestamptz, timestamptz, uuid) to service_role;

do $migration$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* 'public[.](gateway_usage_rollup_15m|gateway_usage_rollup_daily_app|gateway_model_usage_daily|public_app_model_usage_daily|gateway_activity_rollup_daily)'
  ) then
    raise exception 'An RPC still depends on a replaced V1 analytics rollup table';
  end if;
end
$migration$;

comment on function public.refresh_v2_analytics_range(timestamptz, timestamptz, uuid) is
  'Queues and recomputes V2 analytics grains for a bounded time/workspace range.';
