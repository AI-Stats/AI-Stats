-- Public analytics must not expose traffic attributed to routes or models that
-- are not currently visible in the public catalogue.

create or replace view public.v2_web_public_usage_hourly
with (security_invoker = true) as
with meters as (
  select
    meter.rollup_id,
    coalesce(
      max(meter.quantity) filter (where meter.meter_key = 'total_tokens'),
      sum(meter.quantity) filter (where meter.meter_key in ('input_tokens', 'output_tokens')),
      sum(meter.quantity) filter (where meter.meter_key in ('input_text_tokens', 'output_text_tokens')),
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
join public.v2_model_provider_routes route
  on route.provider_model_id = usage.provider_model_id
  and coalesce(route.is_stealth, false) = false
  and route.routing_enabled = true
  and route.status in ('active', 'degraded')
  and (route.effective_from is null or route.effective_from <= now())
  and (route.effective_to is null or route.effective_to > now())
join public.v2_models model
  on model.model_slug = usage.model_slug
  and model.hidden = false
  and model.status <> 'disabled'
left join meters on meters.rollup_id = usage.rollup_id;

create or replace view public.v2_web_public_usage_daily
with (security_invoker = true) as
with meters as (
  select
    meter.rollup_id,
    coalesce(
      max(meter.quantity) filter (where meter.meter_key = 'total_tokens'),
      sum(meter.quantity) filter (where meter.meter_key in ('input_tokens', 'output_tokens')),
      sum(meter.quantity) filter (where meter.meter_key in ('input_text_tokens', 'output_text_tokens')),
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
join public.v2_model_provider_routes route
  on route.provider_model_id = usage.provider_model_id
  and coalesce(route.is_stealth, false) = false
  and route.routing_enabled = true
  and route.status in ('active', 'degraded')
  and (route.effective_from is null or route.effective_from <= now())
  and (route.effective_to is null or route.effective_to > now())
join public.v2_models model
  on model.model_slug = usage.model_slug
  and model.hidden = false
  and model.status <> 'disabled'
left join meters on meters.rollup_id = usage.rollup_id;
