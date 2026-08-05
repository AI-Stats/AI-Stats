-- Complete the private analytics projection with its native V2 cost and meter
-- totals so settings charts do not lose billing or token information.
create or replace view public.v2_web_private_usage_daily
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
  from public.v2_private_usage_daily_meters meter
  group by meter.rollup_id
)
select
  usage.usage_date::timestamptz as bucket_15m,
  usage.workspace_id,
  usage.model_slug as canonical_model_id,
  route.provider_slug as provider,
  usage.app_id,
  usage.requests,
  usage.successful_requests as success_requests,
  usage.cost_nanos::bigint as total_cost_nanos,
  usage.latency_sum_ms,
  usage.latency_count as latency_samples,
  usage.throughput_sum,
  usage.throughput_count as throughput_samples,
  coalesce(meters.total_tokens, 0) as total_tokens
from public.v2_private_usage_daily usage
left join public.v2_model_provider_routes route
  on route.provider_model_id = usage.provider_model_id
left join meters on meters.rollup_id = usage.rollup_id;

grant select on public.v2_web_private_usage_daily to authenticated, service_role;
