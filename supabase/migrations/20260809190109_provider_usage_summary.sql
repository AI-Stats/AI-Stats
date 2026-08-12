-- Provider index telemetry is derived from the existing public hourly and
-- daily rollups. Keep aggregation in Postgres so the public Web API receives
-- one row per provider instead of paging through every model/app grain.

create or replace view public.v2_web_public_usage_hourly
with (security_invoker = true) as
with meters as (
  select
    meter.rollup_id,
    coalesce(
      max(meter.quantity) filter (where meter.meter_key = 'total_tokens'),
      sum(meter.quantity) filter (
        where meter.meter_key in ('input_tokens', 'output_tokens')
      ),
      sum(meter.quantity) filter (
        where meter.meter_key in ('input_text_tokens', 'output_text_tokens')
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
        where meter.meter_key in ('input_tokens', 'output_tokens')
      ),
      sum(meter.quantity) filter (
        where meter.meter_key in ('input_text_tokens', 'output_text_tokens')
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

create or replace function public.get_public_provider_usage_summary()
returns table (
  provider text,
  requests_24h bigint,
  tokens_24h numeric,
  tokens_30d numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hourly as (
    select
      usage.provider,
      coalesce(sum(usage.requests), 0)::bigint as requests_24h,
      coalesce(sum(usage.total_tokens), 0)::numeric as tokens_24h
    from public.v2_web_public_usage_hourly usage
    where usage.provider is not null
      and usage.bucket_15m >= now() - interval '24 hours'
    group by usage.provider
  ),
  daily as (
    select
      usage.provider,
      coalesce(sum(usage.total_tokens), 0)::numeric as tokens_30d
    from public.v2_web_public_usage_daily usage
    where usage.provider is not null
      and usage.day_bucket >= current_date - 29
    group by usage.provider
  ),
  providers as (
    select hourly.provider from hourly
    union
    select daily.provider from daily
  )
  select
    providers.provider,
    coalesce(hourly.requests_24h, 0),
    coalesce(hourly.tokens_24h, 0),
    coalesce(daily.tokens_30d, 0)
  from providers
  left join hourly using (provider)
  left join daily using (provider)
  order by providers.provider;
$$;

revoke all on function public.get_public_provider_usage_summary() from public;
grant execute on function public.get_public_provider_usage_summary()
  to anon, authenticated, service_role;

comment on function public.get_public_provider_usage_summary() is
  'Returns one public usage summary row per provider from durable hourly and daily V2 rollups.';
