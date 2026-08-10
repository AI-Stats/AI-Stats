-- Public performance RPCs may aggregate cross-workspace request facts only for
-- models that are visible through the public catalogue boundary.
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
with visible_model as (
  select model.model_slug
  from public.v2_models model
  where model.model_slug = p_model_slug
    and model.hidden = false
    and model.status <> 'disabled'
), raw as (
  select public.get_v2_model_performance_metrics_unsuppressed(
    visible_model.model_slug,
    p_cloudflare_colo,
    p_percentile,
    p_stream_mode,
    p_context_bucket
  ) payload
  from visible_model
), suppressed as (
  select
    case
      when coalesce((payload #>> '{last_24h,total_requests}')::bigint, 0) >= 20
        then payload -> 'last_24h'
      else '{}'::jsonb
    end last_24h,
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

revoke execute on function public.get_v2_model_performance_metrics(text, text, numeric, text, text)
  from public;
grant execute on function public.get_v2_model_performance_metrics(text, text, numeric, text, text)
  to anon, authenticated, service_role;

do $migration$
declare output_columns integer;
begin
select cardinality(proc.proallargtypes) - proc.pronargs
into output_columns
from pg_proc proc
where proc.oid = 'public.get_v2_model_provider_percentile_series_v2(text,text,text,text)'::regprocedure;

-- A newer cached-input-aware wrapper already includes this catalogue guard.
-- Replacing it with the older return shape would fail and would discard data.
if coalesce(output_columns, 0) <= 12 then
execute $function_sql$
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
  itl_ms numeric
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
where model.model_slug = p_model_slug
  and model.hidden = false
  and model.status <> 'disabled'
  and series.requests >= 20;
$$;
$function_sql$;
end if;
end
$migration$;

revoke execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  from public;
grant execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  to anon, authenticated, service_role;

alter function public.get_v2_model_performance_colos(text)
  rename to get_v2_model_performance_colos_unfiltered;

revoke execute on function public.get_v2_model_performance_colos_unfiltered(text)
  from public, anon, authenticated;
grant execute on function public.get_v2_model_performance_colos_unfiltered(text)
  to service_role;

create function public.get_v2_model_performance_colos(p_model_slug text)
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
  and model.status <> 'disabled';
$$;

revoke execute on function public.get_v2_model_performance_colos(text)
  from public;
grant execute on function public.get_v2_model_performance_colos(text)
  to anon, authenticated, service_role;

alter function public.get_v2_model_provider_health_metrics(text, integer, numeric)
  rename to get_v2_model_provider_health_metrics_unfiltered;

revoke execute on function public.get_v2_model_provider_health_metrics_unfiltered(text, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.get_v2_model_provider_health_metrics_unfiltered(text, integer, numeric)
  to service_role;

create function public.get_v2_model_provider_health_metrics(
  p_model_slug text,
  p_window_days integer default 3,
  p_percentile numeric default 0.5
)
returns table (
  provider_id text,
  provider_name text,
  requests bigint,
  requests_30m bigint,
  success_requests bigint,
  failed_requests bigint,
  neutral_requests bigint,
  rate_limited_requests bigint,
  health_requests bigint,
  health_success_requests bigint,
  uptime_pct numeric,
  request_success_pct numeric,
  avg_latency_ms_30m numeric,
  avg_throughput_30m numeric,
  percentile_latency_ms_30m numeric,
  percentile_throughput_30m numeric,
  avg_latency_ms numeric,
  p50_latency_ms numeric,
  p95_latency_ms numeric,
  percentile_latency_ms numeric,
  avg_generation_ms numeric,
  avg_throughput numeric,
  percentile_throughput numeric,
  total_tokens bigint,
  input_tokens_1h bigint,
  output_tokens_1h bigint,
  cached_read_tokens_1h bigint,
  input_tokens bigint,
  output_tokens bigint,
  finish_reason_counts jsonb,
  error_code_counts jsonb,
  buckets jsonb,
  last_request_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
select health.*
from public.v2_models model
cross join lateral public.get_v2_model_provider_health_metrics_unfiltered(
  model.model_slug,
  p_window_days,
  p_percentile
) health
where model.model_slug = lower(trim(p_model_slug))
  and model.hidden = false
  and model.status <> 'disabled';
$$;

revoke execute on function public.get_v2_model_provider_health_metrics(text, integer, numeric)
  from public;
grant execute on function public.get_v2_model_provider_health_metrics(text, integer, numeric)
  to anon, authenticated, service_role;
