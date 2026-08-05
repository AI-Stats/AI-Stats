-- Corrections found during final V2 cutover review.
--
-- Preserve authored pricing priority, carry real public cost totals, and make
-- app-history merges atomic across the authoritative request ledger and V2
-- analytics projections.

alter table public.v2_public_usage_daily
  add column if not exists cost_nanos numeric(30, 0) not null default 0;
alter table public.v2_public_usage_hourly
  add column if not exists cost_nanos numeric(30, 0) not null default 0;

alter table public.v2_public_usage_daily
  drop constraint if exists v2_public_usage_daily_cost_check;
alter table public.v2_public_usage_daily
  add constraint v2_public_usage_daily_cost_check check (cost_nanos >= 0);
alter table public.v2_public_usage_hourly
  drop constraint if exists v2_public_usage_hourly_cost_check;
alter table public.v2_public_usage_hourly
  add constraint v2_public_usage_hourly_cost_check check (cost_nanos >= 0);

-- Upgrade an already-deployed processor without duplicating the complete
-- function body. Fresh databases already contain the corrected definition in
-- 20260722154000; deployed databases receive the two exact substitutions.
do $migration$
declare
  definition text;
  old_columns text := 'upstream_attempts, failed_upstream_attempts, cached_input_tokens, input_tokens' || chr(10) || '    )';
  new_columns text := 'upstream_attempts, failed_upstream_attempts, cached_input_tokens, input_tokens, cost_nanos' || chr(10) || '    )';
  old_values text := 'coalesce(sum(usage.cached_input_tokens), 0), coalesce(sum(usage.input_tokens), 0)' || chr(10) || '    from public.v2_request_facts fact';
  new_values text := 'coalesce(sum(usage.cached_input_tokens), 0), coalesce(sum(usage.input_tokens), 0),' || chr(10) || '      coalesce(sum(fact.cost_nanos), 0)' || chr(10) || '    from public.v2_request_facts fact';
begin
  select pg_get_functiondef('public.process_v2_analytics_outbox(integer)'::regprocedure)
  into definition;

  if position(old_columns in definition) > 0 then
    definition := replace(definition, old_columns, new_columns);
    definition := replace(definition, old_values, new_values);
    if position(old_columns in definition) > 0 or position(old_values in definition) > 0 then
      raise exception 'Could not fully upgrade V2 analytics processor cost aggregation';
    end if;
    execute definition;
  elsif position('input_tokens, cost_nanos' in definition) = 0 then
    raise exception 'V2 analytics processor has an unexpected definition';
  end if;
end
$migration$;

create or replace view public.v2_web_public_usage_hourly
with (security_invoker = true) as
with meters as (
  select
    meter.rollup_id,
    coalesce(
      max(meter.quantity) filter (where meter.meter_key = 'total_tokens'),
      sum(meter.quantity) filter (
        where meter.meter_key in (
          'input_tokens', 'output_tokens',
          'input_text_tokens', 'output_text_tokens'
        )
      ),
      0
    )::numeric as total_tokens
  from public.v2_public_usage_hourly_meters meter
  group by meter.rollup_id
)
select
  usage.bucket_start as bucket_15m,
  usage.model_slug as canonical_model_id,
  route.provider_slug as provider,
  usage.app_id,
  usage.requests,
  usage.successful_requests as success_requests,
  coalesce(meters.total_tokens, 0) as total_tokens,
  usage.cost_nanos::bigint as total_cost_nanos,
  usage.latency_sum_ms,
  usage.latency_count as latency_samples,
  usage.throughput_sum,
  usage.throughput_count as throughput_samples,
  usage.generation_sum_ms,
  usage.generation_count as generation_samples
from public.v2_public_usage_hourly usage
left join public.v2_model_provider_routes route
  on route.provider_model_id = usage.provider_model_id
left join meters on meters.rollup_id = usage.rollup_id;

create or replace view public.v2_web_public_usage_daily
with (security_invoker = true) as
with meters as (
  select
    meter.rollup_id,
    coalesce(
      max(meter.quantity) filter (where meter.meter_key = 'total_tokens'),
      sum(meter.quantity) filter (
        where meter.meter_key in (
          'input_tokens', 'output_tokens',
          'input_text_tokens', 'output_text_tokens'
        )
      ),
      0
    )::numeric as total_tokens
  from public.v2_public_usage_daily_meters meter
  group by meter.rollup_id
)
select
  usage.usage_date as day_bucket,
  usage.model_slug as canonical_model_id,
  route.provider_slug as provider,
  usage.app_id,
  usage.requests,
  usage.successful_requests as success_requests,
  coalesce(meters.total_tokens, 0) as total_tokens,
  usage.cost_nanos::bigint as total_cost_nanos,
  usage.latency_sum_ms,
  usage.latency_count as latency_samples,
  usage.throughput_sum,
  usage.throughput_count as throughput_samples,
  usage.generation_sum_ms,
  usage.generation_count as generation_samples
from public.v2_public_usage_daily usage
left join public.v2_model_provider_routes route
  on route.provider_model_id = usage.provider_model_id
left join meters on meters.rollup_id = usage.rollup_id;

grant select on public.v2_web_public_usage_hourly,
  public.v2_web_public_usage_daily
to anon, authenticated, service_role;

-- Preserve the authored rule priority already stored in meter metadata. The
-- display-order column remains only a deterministic fallback.
do $migration$
declare
  definition text;
  old_priority text := 'meter.meter_order as priority';
  new_priority text := 'coalesce(nullif(meter.metadata->>''priority'', '''')::integer, meter.meter_order, 100) as priority';
begin
  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;

  if position(old_priority in definition) > 0 then
    definition := replace(definition, old_priority, new_priority);
    execute definition;
  elsif position(new_priority in definition) = 0 then
    raise exception 'Gateway context pricing priority has an unexpected definition';
  end if;
end
$migration$;

create or replace function public.merge_v2_gateway_app_history(
  p_workspace_id uuid,
  p_source_app_id uuid,
  p_target_app_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_count integer;
  v_gateway_requests integer := 0;
  v_request_facts integer := 0;
  v_since timestamptz;
  v_until timestamptz;
begin
  if p_workspace_id is null or p_source_app_id is null or p_target_app_id is null
     or p_source_app_id = p_target_app_id then
    raise exception using errcode = '22023', message = 'invalid_app_merge';
  end if;

  select count(*)::integer into v_app_count
  from public.api_apps app
  where app.workspace_id = p_workspace_id
    and app.id in (p_source_app_id, p_target_app_id);
  if v_app_count <> 2 then
    raise exception using errcode = '23503', message = 'app_merge_target_not_found';
  end if;

  select min(fact.occurred_at), max(fact.occurred_at)
  into v_since, v_until
  from public.v2_request_facts fact
  where fact.workspace_id = p_workspace_id
    and fact.app_id = p_source_app_id;

  update public.gateway_requests request
  set app_id = p_target_app_id
  where request.workspace_id = p_workspace_id
    and request.app_id = p_source_app_id;
  get diagnostics v_gateway_requests = row_count;

  update public.v2_request_facts fact
  set app_id = p_target_app_id
  where fact.workspace_id = p_workspace_id
    and fact.app_id = p_source_app_id;
  get diagnostics v_request_facts = row_count;

  -- Remove the source grains before deleting the app. Otherwise their foreign
  -- keys become null and retain stale traffic under an unattributed bucket.
  delete from public.v2_private_usage_daily rollup
  where rollup.workspace_id = p_workspace_id
    and rollup.app_id = p_source_app_id;
  delete from public.v2_public_usage_daily rollup
  where rollup.app_id = p_source_app_id;
  delete from public.v2_public_usage_hourly rollup
  where rollup.app_id = p_source_app_id;

  if v_since is not null then
    perform public.refresh_v2_analytics_range(
      v_since,
      v_until + interval '1 microsecond',
      p_workspace_id
    );
  end if;

  delete from public.api_apps app
  where app.workspace_id = p_workspace_id
    and app.id = p_source_app_id;

  return jsonb_build_object(
    'gateway_requests', v_gateway_requests,
    'request_facts', v_request_facts
  );
end;
$$;

revoke all on function public.merge_v2_gateway_app_history(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.merge_v2_gateway_app_history(uuid, uuid, uuid)
to service_role;

comment on function public.merge_v2_gateway_app_history(uuid, uuid, uuid) is
  'Atomically moves authoritative request history and V2 analytics to a target app, rebuilds affected grains, and deletes the source app.';

-- Recompute all existing public cost totals after adding the new rollup field.
select public.refresh_v2_analytics_range(
  min(fact.occurred_at),
  now() + interval '1 second',
  null
)
from public.v2_request_facts fact;
