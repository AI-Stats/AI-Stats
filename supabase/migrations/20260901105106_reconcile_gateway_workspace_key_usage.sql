-- Reconcile the usage aggregate selected by the Gateway key management API.
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

notify pgrst, 'reload schema';
