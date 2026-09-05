-- Keep stealth provider identities out of the public canonical-resolution
-- oracle and restore the minimum cohort used for cross-workspace telemetry.

create or replace function public.get_v2_model_resolution(p_requested_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (select lower(trim(p_requested_slug)) as slug),
  direct as (
    select model.model_slug
    from public.v2_models model, requested
    where model.model_slug = requested.slug
      and model.hidden = false and model.status <> 'disabled'
    limit 1
  ), alias as (
    select alias.model_slug
    from public.v2_model_aliases alias
    join public.v2_models model on model.model_slug = alias.model_slug
    cross join requested
    where alias.alias_slug = requested.slug and alias.enabled = true
      and (alias.effective_from is null or alias.effective_from <= now())
      and (alias.effective_to is null or alias.effective_to > now())
      and model.hidden = false and model.status <> 'disabled'
    limit 1
  ), route as (
    select route.model_slug
    from public.v2_model_provider_routes route
    join public.v2_models model on model.model_slug = route.model_slug
    cross join requested
    where (route.provider_model_id = requested.slug or route.provider_model_slug = requested.slug)
      and coalesce(route.is_stealth, false) = false
      and route.routing_enabled = true
      and route.status in ('active', 'degraded')
      and model.hidden = false and model.status <> 'disabled'
    order by route.status = 'active' desc, route.provider_model_id
    limit 1
  )
  select jsonb_build_object(
    'requestedModelId', p_requested_slug,
    'canonicalModelId', coalesce((select model_slug from direct), (select model_slug from alias), (select model_slug from route)),
    'internalModelId', coalesce((select model_slug from direct), (select model_slug from alias), (select model_slug from route)),
    'source', case
      when exists (select 1 from direct) then 'direct'
      when exists (select 1 from alias) then 'alias'
      when exists (select 1 from route) then 'provider_mapping'
      else 'unresolved'
    end
  );
$$;

create or replace function public.get_v2_model_performance_metrics(
  p_model_slug text,
  p_cloudflare_colo text default null,
  p_percentile numeric default 0.5,
  p_stream_mode text default 'all',
  p_context_bucket text default 'all'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with raw as (
  select public.get_v2_model_performance_metrics_unsuppressed(
    model.model_slug,
    p_cloudflare_colo,
    p_percentile,
    p_stream_mode,
    p_context_bucket
  ) payload
  from public.v2_models model
  where model.model_slug = lower(trim(p_model_slug))
    and model.hidden = false
    and model.status <> 'disabled'
), suppressed as (
  select
    case when coalesce((payload #>> '{last_24h,total_requests}')::bigint, 0) >= 20
      then payload -> 'last_24h' else '{}'::jsonb end last_24h,
    coalesce((
      select jsonb_agg(entry order by entry ->> 'bucket')
      from jsonb_array_elements(coalesce(payload -> 'hourly_24h', '[]'::jsonb)) entry
      where coalesce((entry ->> 'requests')::bigint, 0) >= 20
    ), '[]'::jsonb) hourly_24h,
    coalesce((
      select jsonb_agg(entry order by entry ->> 'day', entry ->> 'provider')
      from jsonb_array_elements(coalesce(payload -> 'provider_daily_7d', '[]'::jsonb)) entry
      where coalesce((entry ->> 'requests')::bigint, 0) >= 20
    ), '[]'::jsonb) provider_daily_7d,
    payload
  from raw
)
select jsonb_set(
  jsonb_set(
    jsonb_set(payload, '{last_24h}', last_24h),
    '{hourly_24h}', hourly_24h
  ),
  '{provider_daily_7d}', provider_daily_7d
)
from suppressed;
$$;

create or replace function public.get_v2_model_provider_percentile_series_v2(
  p_model_slug text,
  p_cloudflare_colo text default null,
  p_stream_mode text default 'all',
  p_context_bucket text default 'all'
)
returns table (
  usage_day date,
  provider_id text,
  provider_name text,
  requests bigint,
  percentile integer,
  gateway_ttft_ms numeric,
  provider_duration_ms numeric,
  effective_throughput_tps numeric,
  output_speed_tps numeric,
  phaseo_overhead_ms numeric,
  tpot_ms numeric,
  itl_ms numeric,
  cached_input_pct numeric
)
language sql
stable
security definer
set search_path = ''
as $$
select series.*
from public.v2_models model
cross join lateral public.get_v2_model_provider_percentile_series_v2_unsuppressed(
  model.model_slug,
  p_cloudflare_colo,
  p_stream_mode,
  p_context_bucket
) series
where model.model_slug = lower(trim(p_model_slug))
  and model.hidden = false
  and model.status <> 'disabled'
  and series.requests >= 20;
$$;

create or replace function public.get_v2_model_performance_colos(p_model_slug text)
returns table (cloudflare_colo text, request_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
select colos.*
from public.v2_models model
cross join lateral public.get_v2_model_performance_colos_unfiltered(model.model_slug) colos
where model.model_slug = lower(trim(p_model_slug))
  and model.hidden = false
  and model.status <> 'disabled'
  and colos.request_count >= 20;
$$;

revoke execute on function public.get_v2_model_resolution(text) from public;
grant execute on function public.get_v2_model_resolution(text) to anon, authenticated, service_role;
revoke execute on function public.get_v2_model_performance_metrics(text, text, numeric, text, text) from public;
grant execute on function public.get_v2_model_performance_metrics(text, text, numeric, text, text) to anon, authenticated, service_role;
revoke execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text) from public;
grant execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text) to anon, authenticated, service_role;
revoke execute on function public.get_v2_model_performance_colos(text) from public;
grant execute on function public.get_v2_model_performance_colos(text) to anon, authenticated, service_role;
