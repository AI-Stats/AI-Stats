-- Public performance data is cross-workspace telemetry. Suppress cohorts smaller
-- than 20 requests so query filters cannot be used to identify individual usage.

alter function public.get_v2_model_performance_metrics(text, text, numeric, text, text)
  rename to get_v2_model_performance_metrics_unsuppressed;

revoke execute on function public.get_v2_model_performance_metrics_unsuppressed(text, text, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.get_v2_model_performance_metrics_unsuppressed(text, text, numeric, text, text)
  to service_role;

create function public.get_v2_model_performance_metrics(
  p_model_slug text,
  p_cloudflare_colo text default null,
  p_percentile numeric default 0.5,
  p_stream_mode text default 'all',
  p_context_bucket text default 'all'
)
returns jsonb
language sql
stable
-- The public wrapper needs definer privileges only to call the private raw RPC;
-- its fixed query exposes exclusively the suppressed projection below.
security definer
set search_path = ''
as $$
with raw as (
  select public.get_v2_model_performance_metrics_unsuppressed(
    p_model_slug,
    p_cloudflare_colo,
    p_percentile,
    p_stream_mode,
    p_context_bucket
  ) payload
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

alter function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  rename to get_v2_model_provider_percentile_series_v2_unsuppressed;

revoke execute on function public.get_v2_model_provider_percentile_series_v2_unsuppressed(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_v2_model_provider_percentile_series_v2_unsuppressed(text, text, text, text)
  to service_role;

create function public.get_v2_model_provider_percentile_series_v2(
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
-- As above, callers can execute only the fixed >= 20-request projection.
security definer
set search_path = ''
as $$
select series.*
from public.get_v2_model_provider_percentile_series_v2_unsuppressed(
  p_model_slug,
  p_cloudflare_colo,
  p_stream_mode,
  p_context_bucket
) series
where series.requests >= 20;
$$;

revoke execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  from public;
grant execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  to anon, authenticated, service_role;
