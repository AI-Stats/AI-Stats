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

revoke execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  from public;
grant execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  to anon, authenticated, service_role;
