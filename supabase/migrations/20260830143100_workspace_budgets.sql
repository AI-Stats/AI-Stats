-- Workspace spend budgets shared by synchronous and asynchronous gateway paths.

update public.oauth_clients
set allowed_scopes = array(
  select distinct scope
  from unnest(coalesce(allowed_scopes, '{}'::text[]) || array['budgets:read', 'budgets:write', 'budgets:delete']) scope
  order by scope
), updated_at = now()
where id = 'phaseo_cli';

create table if not exists public.workspace_budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  interval text not null check (interval in ('daily', 'weekly', 'monthly', 'lifetime')),
  limit_nanos bigint not null check (limit_nanos > 0),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, interval)
);

create index if not exists workspace_budgets_workspace_id_idx
  on public.workspace_budgets (workspace_id);

alter table public.workspace_budgets enable row level security;

drop policy if exists workspace_budgets_select_member on public.workspace_budgets;
create policy workspace_budgets_select_member on public.workspace_budgets
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

revoke all on table public.workspace_budgets from public, anon;
grant select on table public.workspace_budgets to authenticated;
grant all on table public.workspace_budgets to service_role;

create or replace function public.lock_workspace_budget_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  v_workspace_id := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text, 0));
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.lock_workspace_budget_change() from public, anon, authenticated;

drop trigger if exists workspace_budgets_lock_change on public.workspace_budgets;
create trigger workspace_budgets_lock_change
before insert or update or delete on public.workspace_budgets
for each row execute function public.lock_workspace_budget_change();

create or replace function public.gateway_workspace_budget_status(
  p_workspace_id uuid,
  p_requested_amount_nanos bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_result jsonb;
  v_exceeded jsonb;
begin
  if p_workspace_id is null then
    raise exception 'workspace_id_required';
  end if;
  if coalesce(p_requested_amount_nanos, 0) < 0 then
    raise exception 'requested_amount_must_be_non_negative';
  end if;

  with configured as (
    select
      budget.id,
      budget.workspace_id,
      budget.interval,
      budget.limit_nanos,
      budget.created_by,
      budget.created_at,
      budget.updated_at,
      case budget.interval
        when 'daily' then date_trunc('day', v_now at time zone 'utc') at time zone 'utc'
        when 'weekly' then date_trunc('week', v_now at time zone 'utc') at time zone 'utc'
        when 'monthly' then date_trunc('month', v_now at time zone 'utc') at time zone 'utc'
        else null
      end as window_start,
      case budget.interval
        when 'daily' then (date_trunc('day', v_now at time zone 'utc') + interval '1 day') at time zone 'utc'
        when 'weekly' then (date_trunc('week', v_now at time zone 'utc') + interval '1 week') at time zone 'utc'
        when 'monthly' then (date_trunc('month', v_now at time zone 'utc') + interval '1 month') at time zone 'utc'
        else null
      end as reset_at
    from public.workspace_budgets budget
    where budget.workspace_id = p_workspace_id
  ), request_usage as (
    select
      configured.id,
      coalesce(sum(request.cost_nanos) filter (
        where request.success is true
          and (configured.window_start is null or request.created_at >= configured.window_start)
      ), 0)::bigint as completed_nanos
    from configured
    left join public.gateway_requests request
      on request.workspace_id = configured.workspace_id
    group by configured.id
  ), reservation_usage as (
    select
      configured.id,
      coalesce(sum(greatest(
        reservation.amount_nanos
          - coalesce(reservation.captured_nanos, 0)
          - coalesce(reservation.released_nanos, 0),
        0
      )) filter (
        where reservation.status = 'reserved'
          and (configured.window_start is null or reservation.created_at >= configured.window_start)
      ), 0)::bigint as held_nanos
    from configured
    left join public.gateway_wallet_reservations reservation
      on reservation.workspace_id = configured.workspace_id
    group by configured.id
  ), usage_rows as (
    select
      configured.*,
      request_usage.completed_nanos + reservation_usage.held_nanos as usage_nanos
    from configured
    join request_usage using (id)
    join reservation_usage using (id)
  ), normalized as (
    select *,
      usage_nanos + coalesce(p_requested_amount_nanos, 0) as projected_usage_nanos,
      greatest(limit_nanos - usage_nanos, 0) as remaining_nanos,
      case
        when coalesce(p_requested_amount_nanos, 0) > 0
          then usage_nanos + p_requested_amount_nanos > limit_nanos
        else usage_nanos >= limit_nanos
      end as exceeded
    from usage_rows
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'workspace_id', workspace_id,
    'interval', interval,
    'limit_nanos', limit_nanos,
    'usage_nanos', usage_nanos,
    'remaining_nanos', remaining_nanos,
    'projected_usage_nanos', projected_usage_nanos,
    'exceeded', exceeded,
    'window_start', window_start,
    'reset_at', reset_at,
    'created_by', created_by,
    'created_at', created_at,
    'updated_at', updated_at
  ) order by case interval when 'daily' then 1 when 'weekly' then 2 when 'monthly' then 3 else 4 end), '[]'::jsonb)
  into v_result
  from normalized;

  select budget
  into v_exceeded
  from jsonb_array_elements(v_result) budget
  where (budget->>'exceeded')::boolean
  order by case budget->>'interval' when 'daily' then 1 when 'weekly' then 2 when 'monthly' then 3 else 4 end
  limit 1;

  if v_exceeded is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'workspace_' || (v_exceeded->>'interval') || '_cost_budget_reached',
      'limit_window', v_exceeded->>'interval',
      'limit_metric', 'cost',
      'current_value', (v_exceeded->>'usage_nanos')::bigint,
      'limit_value', (v_exceeded->>'limit_nanos')::bigint,
      'reset_at', v_exceeded->'reset_at',
      'now', to_jsonb(v_now),
      'budgets', v_result
    );
  end if;

  return jsonb_build_object('ok', true, 'reason', null, 'now', to_jsonb(v_now), 'budgets', v_result);
end;
$$;

revoke all on function public.gateway_workspace_budget_status(uuid, bigint) from public, anon, authenticated;
grant execute on function public.gateway_workspace_budget_status(uuid, bigint) to service_role;

create or replace function public.gateway_workspace_key_usage(
  p_workspace_id uuid,
  p_key_ids uuid[] default null
)
returns table (
  key_id uuid,
  total_request_count bigint,
  daily_request_count bigint,
  weekly_request_count bigint,
  monthly_request_count bigint,
  total_cost_nanos bigint,
  daily_cost_nanos bigint,
  weekly_cost_nanos bigint,
  monthly_cost_nanos bigint,
  last_used_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('day', now() at time zone 'utc') at time zone 'utc' as day_start,
      date_trunc('week', now() at time zone 'utc') at time zone 'utc' as week_start,
      date_trunc('month', now() at time zone 'utc') at time zone 'utc' as month_start
  )
  select
    request.key_id,
    count(*)::bigint,
    count(*) filter (where request.created_at >= bounds.day_start)::bigint,
    count(*) filter (where request.created_at >= bounds.week_start)::bigint,
    count(*) filter (where request.created_at >= bounds.month_start)::bigint,
    coalesce(sum(request.cost_nanos), 0)::bigint,
    coalesce(sum(request.cost_nanos) filter (where request.created_at >= bounds.day_start), 0)::bigint,
    coalesce(sum(request.cost_nanos) filter (where request.created_at >= bounds.week_start), 0)::bigint,
    coalesce(sum(request.cost_nanos) filter (where request.created_at >= bounds.month_start), 0)::bigint,
    max(request.created_at)
  from public.gateway_requests request
  cross join bounds
  where request.workspace_id = p_workspace_id
    and request.key_id is not null
    and request.success is true
    and (p_key_ids is null or request.key_id = any(p_key_ids))
  group by request.key_id;
$$;

revoke all on function public.gateway_workspace_key_usage(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.gateway_workspace_key_usage(uuid, uuid[]) to service_role;

drop function if exists public.gateway_fetch_request_context_without_workspace_budget(uuid, text, text, uuid);
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'gateway_fetch_request_context',
    'gateway_fetch_request_context_without_workspace_budget'
  );
end;
$$;

revoke all on function public.gateway_fetch_request_context_without_workspace_budget(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.gateway_fetch_request_context_without_workspace_budget(uuid, text, text, uuid)
  to service_role;

create or replace function public.gateway_fetch_request_context(
  workspace_id uuid,
  model text,
  endpoint text,
  api_key_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context jsonb;
  v_budget_status jsonb;
begin
  v_context := public.gateway_fetch_request_context_without_workspace_budget(workspace_id, model, endpoint, api_key_id);
  v_budget_status := public.gateway_workspace_budget_status(workspace_id, 0);
  if coalesce((v_context->'key_limit_ok'->>'ok')::boolean, true)
    and not coalesce((v_budget_status->>'ok')::boolean, true) then
    v_context := jsonb_set(v_context, '{key_limit_ok}', v_budget_status, true);
  end if;
  return v_context;
end;
$$;

revoke all on function public.gateway_fetch_request_context(uuid, text, text, uuid) from public, anon;
grant execute on function public.gateway_fetch_request_context(uuid, text, text, uuid) to authenticated, service_role;

drop function if exists public.gateway_wallet_reserve_once_without_workspace_budget(uuid, text, bigint, text, uuid, integer);
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.gateway_wallet_reserve_once(uuid,text,bigint,text,uuid,integer)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'gateway_wallet_reserve_once',
    'gateway_wallet_reserve_once_without_workspace_budget'
  );
end;
$$;

revoke all on function public.gateway_wallet_reserve_once_without_workspace_budget(uuid, text, bigint, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.gateway_wallet_reserve_once_without_workspace_budget(uuid, text, bigint, text, uuid, integer)
  to service_role;

create or replace function public.gateway_wallet_reserve_once(
  p_workspace_id uuid,
  p_reservation_id text,
  p_amount_nanos bigint,
  p_hold_ref_id text default null,
  p_key_id uuid default null,
  p_request_count integer default null
)
returns table (
  ok boolean,
  applied boolean,
  reason text,
  amount_nanos bigint,
  before_balance_nanos bigint,
  after_balance_nanos bigint,
  before_reserved_nanos bigint,
  after_reserved_nanos bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget_status jsonb;
begin
  -- Serialize new reservations against budget configuration updates. Existing
  -- reservations remain idempotent and are validated by the original RPC.
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));
  perform 1 from public.workspace_budgets
    where workspace_id = p_workspace_id
    order by interval
    for update;

  if not exists (
    select 1 from public.gateway_wallet_reservations
    where workspace_id = p_workspace_id and reservation_id = p_reservation_id
  ) then
    v_budget_status := public.gateway_workspace_budget_status(p_workspace_id, p_amount_nanos);
    if not coalesce((v_budget_status->>'ok')::boolean, true) then
      return query select false, false, (v_budget_status->>'reason')::text, p_amount_nanos,
        null::bigint, null::bigint, null::bigint, null::bigint;
      return;
    end if;
  end if;

  return query
  select * from public.gateway_wallet_reserve_once_without_workspace_budget(
    p_workspace_id, p_reservation_id, p_amount_nanos, p_hold_ref_id, p_key_id, p_request_count
  );
end;
$$;

revoke all on function public.gateway_wallet_reserve_once(uuid, text, bigint, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.gateway_wallet_reserve_once(uuid, text, bigint, text, uuid, integer)
  to service_role;

alter function public.gateway_realtime_create_with_hold(
  uuid, text, uuid, text, text, text, text, text, text, timestamptz,
  text, text, bigint, text, jsonb, integer, integer, integer, integer
) rename to gateway_realtime_create_with_hold_without_workspace_budget;

create function public.gateway_realtime_create_with_hold(
  p_workspace_id uuid,
  p_session_id text,
  p_key_id uuid,
  p_user_id text,
  p_source text,
  p_provider text,
  p_model_id text,
  p_provider_model_id text,
  p_voice text,
  p_expires_at timestamptz,
  p_reservation_prefix text,
  p_reservation_id text,
  p_hold_nanos bigint,
  p_client_secret_hash text,
  p_metadata jsonb default '{}'::jsonb,
  p_max_workspace_sessions integer default 8,
  p_max_key_sessions integer default 4,
  p_max_user_sessions integer default 1,
  p_max_creations_per_minute integer default 8
)
returns setof public.gateway_realtime_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget_status jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));
  v_budget_status := public.gateway_workspace_budget_status(p_workspace_id, p_hold_nanos);
  if not coalesce((v_budget_status->>'ok')::boolean, true) then
    raise exception '%', v_budget_status->>'reason';
  end if;

  return query select * from public.gateway_realtime_create_with_hold_without_workspace_budget(
    p_workspace_id, p_session_id, p_key_id, p_user_id, p_source, p_provider,
    p_model_id, p_provider_model_id, p_voice, p_expires_at, p_reservation_prefix,
    p_reservation_id, p_hold_nanos, p_client_secret_hash, p_metadata,
    p_max_workspace_sessions, p_max_key_sessions, p_max_user_sessions,
    p_max_creations_per_minute
  );
end;
$$;

revoke all on function public.gateway_realtime_create_with_hold(
  uuid, text, uuid, text, text, text, text, text, text, timestamptz,
  text, text, bigint, text, jsonb, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.gateway_realtime_create_with_hold(
  uuid, text, uuid, text, text, text, text, text, text, timestamptz,
  text, text, bigint, text, jsonb, integer, integer, integer, integer
) to service_role;

alter function public.gateway_realtime_extend_hold_once(uuid, text, text, bigint, bigint)
  rename to gateway_realtime_extend_hold_once_without_workspace_budget;

create function public.gateway_realtime_extend_hold_once(
  p_workspace_id uuid,
  p_session_id text,
  p_reservation_id text,
  p_target_reserved_nanos bigint,
  p_estimated_cost_nanos bigint default 0
)
returns setof public.gateway_realtime_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_reserved_nanos bigint;
  v_additional_nanos bigint;
  v_budget_status jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 0));
  select reserved_nanos into v_current_reserved_nanos
  from public.gateway_realtime_sessions
  where workspace_id = p_workspace_id and session_id = p_session_id;
  if not found then raise exception 'realtime_session_not_found'; end if;

  v_additional_nanos := greatest(0, coalesce(p_target_reserved_nanos, 0) - coalesce(v_current_reserved_nanos, 0));
  if v_additional_nanos > 0 then
    v_budget_status := public.gateway_workspace_budget_status(p_workspace_id, v_additional_nanos);
    if not coalesce((v_budget_status->>'ok')::boolean, true) then
      raise exception '%', v_budget_status->>'reason';
    end if;
  end if;

  return query select * from public.gateway_realtime_extend_hold_once_without_workspace_budget(
    p_workspace_id, p_session_id, p_reservation_id, p_target_reserved_nanos,
    p_estimated_cost_nanos
  );
end;
$$;

revoke all on function public.gateway_realtime_extend_hold_once(uuid, text, text, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.gateway_realtime_extend_hold_once(uuid, text, text, bigint, bigint)
  to service_role;

comment on table public.workspace_budgets is
  'Workspace-wide cost ceilings enforced across synchronous and reserved gateway workloads.';
