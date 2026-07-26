-- Stable Web API projections backed exclusively by V2 request facts and
-- analytics rollups. These preserve the established response vocabulary while
-- preventing application fetchers from reading the legacy request tables.

create or replace view public.v2_web_gateway_requests
with (security_invoker = true) as
select
  request_row.*,
  fact.safe_metadata->'error_payload' as error_payload,
  fact.safe_metadata as detail_metadata
from public.v2_rpc_gateway_requests_legacy_shape request_row
join public.v2_request_facts fact on fact.request_event_id = request_row.id;

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
  0::bigint as total_cost_nanos,
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
  0::bigint as total_cost_nanos,
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

grant select on public.v2_web_gateway_requests,
  public.v2_web_public_usage_hourly,
  public.v2_web_public_usage_daily,
  public.v2_web_private_usage_daily
to anon, authenticated, service_role;

comment on view public.v2_web_gateway_requests is
  'Read-only Web API request projection sourced only from V2 observability facts.';
comment on view public.v2_web_public_usage_hourly is
  'Public hourly analytics projection sourced only from V2 rollups and meters.';
comment on view public.v2_web_public_usage_daily is
  'Public daily analytics projection sourced only from V2 rollups and meters.';
comment on view public.v2_web_private_usage_daily is
  'Workspace daily analytics projection sourced only from V2 rollups.';
