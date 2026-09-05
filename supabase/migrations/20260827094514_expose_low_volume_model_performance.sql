-- Model pages need to surface live performance for low-volume models. Keep the
-- public-catalogue visibility boundary, but stop replacing valid aggregates
-- with empty payloads solely because their request cohort is smaller than 20.
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
select public.get_v2_model_performance_metrics_unsuppressed(
  model.model_slug,
  p_cloudflare_colo,
  p_percentile,
  p_stream_mode,
  p_context_bucket
)
from public.v2_models model
where model.model_slug = lower(trim(p_model_slug))
  and model.hidden = false
  and model.status <> 'disabled';
$$;

revoke execute on function public.get_v2_model_performance_metrics(text, text, numeric, text, text)
  from public;
grant execute on function public.get_v2_model_performance_metrics(text, text, numeric, text, text)
  to anon, authenticated, service_role;

-- The dashboard uses this series for its percentile trend. Applying the old
-- per-day >= 20 filter here would still leave low-volume charts empty even
-- after the summary RPC starts returning data.
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
  and model.status <> 'disabled';
$$;

revoke execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  from public;
grant execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  to anon, authenticated, service_role;
