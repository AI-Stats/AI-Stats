-- Canonical generative-AI performance telemetry.
--
-- Legacy latency_ms/generation_ms/throughput columns remain intact for
-- compatibility. New columns make the clock boundaries and formula explicit.

alter table public.gateway_requests
  add column if not exists provider_ttft_ms integer,
  add column if not exists gateway_ttft_ms integer,
  add column if not exists output_speed_tps numeric(30, 12),
  add column if not exists tpot_ms numeric(30, 12),
  add column if not exists itl_ms numeric(30, 12),
  add column if not exists phaseo_overhead_ms integer;

alter table public.v2_request_facts
  add column if not exists provider_ttft_ms integer,
  add column if not exists gateway_ttft_ms integer,
  add column if not exists output_speed_tps numeric(30, 12),
  add column if not exists tpot_ms numeric(30, 12),
  add column if not exists itl_ms numeric(30, 12),
  add column if not exists phaseo_overhead_ms integer;

alter table public.gateway_requests
  add constraint gateway_requests_performance_metrics_nonnegative check (
    (provider_ttft_ms is null or provider_ttft_ms >= 0) and
    (gateway_ttft_ms is null or gateway_ttft_ms >= 0) and
    (output_speed_tps is null or output_speed_tps >= 0) and
    (tpot_ms is null or tpot_ms >= 0) and
    (itl_ms is null or itl_ms >= 0) and
    (phaseo_overhead_ms is null or phaseo_overhead_ms >= 0)
  ) not valid;

alter table public.v2_request_facts
  add constraint v2_request_facts_performance_metrics_nonnegative check (
    (provider_ttft_ms is null or provider_ttft_ms >= 0) and
    (gateway_ttft_ms is null or gateway_ttft_ms >= 0) and
    (output_speed_tps is null or output_speed_tps >= 0) and
    (tpot_ms is null or tpot_ms >= 0) and
    (itl_ms is null or itl_ms >= 0) and
    (phaseo_overhead_ms is null or phaseo_overhead_ms >= 0)
  ) not valid;

create or replace function public.copy_v2_performance_metrics_from_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  performance jsonb := coalesce(new.safe_metadata->'performance', '{}'::jsonb);
begin
  new.provider_ttft_ms := nullif(performance->>'provider_ttft_ms', '')::integer;
  new.gateway_ttft_ms := nullif(performance->>'gateway_ttft_ms', '')::integer;
  new.output_speed_tps := nullif(performance->>'output_speed_tps', '')::numeric;
  new.tpot_ms := nullif(performance->>'tpot_ms', '')::numeric;
  new.itl_ms := nullif(performance->>'itl_ms', '')::numeric;
  new.phaseo_overhead_ms := nullif(performance->>'phaseo_overhead_ms', '')::integer;
  return new;
end;
$$;

drop trigger if exists v2_request_facts_copy_performance_metrics
  on public.v2_request_facts;
create trigger v2_request_facts_copy_performance_metrics
before insert or update of safe_metadata
on public.v2_request_facts
for each row execute function public.copy_v2_performance_metrics_from_metadata();

create index if not exists v2_request_facts_model_stream_context_time_idx
  on public.v2_request_facts (
    coalesce(routed_model_slug, requested_model_slug),
    stream,
    occurred_at desc
  );

comment on column public.v2_request_facts.provider_ttft_ms is
  'Selected provider dispatch to first content-bearing generated output; streaming text requests only.';
comment on column public.v2_request_facts.gateway_ttft_ms is
  'Gateway request start to first content-bearing generated output; user-visible TTFT.';
comment on column public.v2_request_facts.throughput is
  'Effective output speed: all output tokens divided by the full selected-provider duration.';
comment on column public.v2_request_facts.output_speed_tps is
  'Output speed after first token: output tokens after the first divided by provider duration after TTFT.';
comment on column public.v2_request_facts.tpot_ms is
  'Average time per output token after the first token.';
comment on column public.v2_request_facts.itl_ms is
  'Average inter-token latency; currently the request-level TPOT estimate.';
comment on column public.v2_request_facts.phaseo_overhead_ms is
  'Gateway end-to-end duration minus selected-provider duration.';

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
security invoker
set search_path = public
as $$
with params as (
  select
    lower(trim(p_model_slug)) model_slug,
    nullif(upper(trim(p_cloudflare_colo)), '') cloudflare_colo,
    greatest(0.01, least(0.99, coalesce(p_percentile, 0.5)))::double precision percentile,
    case when lower(p_stream_mode) in ('stream', 'non_stream') then lower(p_stream_mode) else 'all' end stream_mode,
    case when lower(p_context_bucket) in ('lte_4k', '4k_16k', '16k_64k', 'gt_64k') then lower(p_context_bucket) else 'all' end context_bucket,
    now() now_ts
),
usage_tokens as (
  select usage.request_event_id,
    sum(usage.quantity) filter (where usage.meter_key in ('input_tokens', 'input_text_tokens', 'prompt_tokens'))::numeric input_tokens
  from public.v2_request_usage usage
  where usage.meter_key in ('input_tokens', 'input_text_tokens', 'prompt_tokens')
  group by usage.request_event_id
),
base as (
  select date_trunc('hour', fact.occurred_at) bucket_start,
    fact.occurred_at::date usage_day,
    route.provider_slug provider_id,
    fact.success, fact.stream, tokens.input_tokens,
    fact.gateway_ttft_ms, fact.provider_ttft_ms, fact.generation_ms provider_duration_ms,
    fact.gateway_total_ms gateway_e2e_ms, fact.phaseo_overhead_ms,
    fact.throughput effective_throughput_tps, fact.output_speed_tps,
    fact.tpot_ms, fact.itl_ms
  from public.v2_request_facts fact
  left join public.v2_model_provider_routes route on route.provider_model_id = fact.provider_model_id
  left join usage_tokens tokens on tokens.request_event_id = fact.request_event_id
  cross join params
  where coalesce(fact.routed_model_slug, fact.requested_model_slug) = params.model_slug
    and fact.occurred_at >= params.now_ts - interval '7 days'
    and (params.cloudflare_colo is null or upper(trim(fact.cloudflare_colo)) = params.cloudflare_colo)
    and (params.stream_mode = 'all' or fact.stream = (params.stream_mode = 'stream'))
    and (
      params.context_bucket = 'all'
      or (params.context_bucket = 'lte_4k' and tokens.input_tokens <= 4096)
      or (params.context_bucket = '4k_16k' and tokens.input_tokens > 4096 and tokens.input_tokens <= 16384)
      or (params.context_bucket = '16k_64k' and tokens.input_tokens > 16384 and tokens.input_tokens <= 65536)
      or (params.context_bucket = 'gt_64k' and tokens.input_tokens > 65536)
    )
),
hourly as (
  select bucket_start, count(*)::bigint requests,
    count(*) filter (where success)::bigint successful_requests,
    percentile_cont((select percentile from params)) within group (order by gateway_ttft_ms)
      filter (where success and gateway_ttft_ms is not null)::numeric gateway_ttft_ms,
    percentile_cont((select percentile from params)) within group (order by provider_ttft_ms)
      filter (where success and provider_ttft_ms is not null)::numeric provider_ttft_ms,
    percentile_cont((select percentile from params)) within group (order by provider_duration_ms)
      filter (where success and provider_duration_ms is not null)::numeric provider_duration_ms,
    percentile_cont((select percentile from params)) within group (order by gateway_e2e_ms)
      filter (where success and gateway_e2e_ms is not null)::numeric gateway_e2e_ms,
    percentile_cont((select percentile from params)) within group (order by phaseo_overhead_ms)
      filter (where success and phaseo_overhead_ms is not null)::numeric phaseo_overhead_ms,
    percentile_cont((select percentile from params)) within group (order by effective_throughput_tps)
      filter (where success and effective_throughput_tps is not null)::numeric effective_throughput_tps,
    percentile_cont((select percentile from params)) within group (order by output_speed_tps)
      filter (where success and output_speed_tps is not null)::numeric output_speed_tps,
    percentile_cont((select percentile from params)) within group (order by tpot_ms)
      filter (where success and tpot_ms is not null)::numeric tpot_ms,
    percentile_cont((select percentile from params)) within group (order by itl_ms)
      filter (where success and itl_ms is not null)::numeric itl_ms
  from base group by bucket_start
),
provider_daily as (
  select usage_day, provider_id, count(*)::bigint requests,
    percentile_cont((select percentile from params)) within group (order by gateway_ttft_ms)
      filter (where success and gateway_ttft_ms is not null)::numeric gateway_ttft_ms,
    percentile_cont((select percentile from params)) within group (order by provider_duration_ms)
      filter (where success and provider_duration_ms is not null)::numeric provider_duration_ms,
    percentile_cont((select percentile from params)) within group (order by effective_throughput_tps)
      filter (where success and effective_throughput_tps is not null)::numeric effective_throughput_tps,
    percentile_cont((select percentile from params)) within group (order by output_speed_tps)
      filter (where success and output_speed_tps is not null)::numeric output_speed_tps,
    percentile_cont((select percentile from params)) within group (order by phaseo_overhead_ms)
      filter (where success and phaseo_overhead_ms is not null)::numeric phaseo_overhead_ms,
    percentile_cont((select percentile from params)) within group (order by tpot_ms)
      filter (where success and tpot_ms is not null)::numeric tpot_ms,
    percentile_cont((select percentile from params)) within group (order by itl_ms)
      filter (where success and itl_ms is not null)::numeric itl_ms
  from base where provider_id is not null group by usage_day, provider_id
),
recent as (select * from base where bucket_start >= (select now_ts from params) - interval '24 hours'),
summary as (
  select count(*)::bigint requests, count(*) filter (where success)::bigint successful_requests,
    percentile_cont((select percentile from params)) within group (order by gateway_ttft_ms) filter (where success and gateway_ttft_ms is not null)::numeric gateway_ttft_ms,
    percentile_cont((select percentile from params)) within group (order by provider_duration_ms) filter (where success and provider_duration_ms is not null)::numeric provider_duration_ms,
    percentile_cont((select percentile from params)) within group (order by effective_throughput_tps) filter (where success and effective_throughput_tps is not null)::numeric effective_throughput_tps,
    percentile_cont((select percentile from params)) within group (order by output_speed_tps) filter (where success and output_speed_tps is not null)::numeric output_speed_tps,
    percentile_cont((select percentile from params)) within group (order by phaseo_overhead_ms) filter (where success and phaseo_overhead_ms is not null)::numeric phaseo_overhead_ms,
    percentile_cont((select percentile from params)) within group (order by tpot_ms) filter (where success and tpot_ms is not null)::numeric tpot_ms,
    percentile_cont((select percentile from params)) within group (order by itl_ms) filter (where success and itl_ms is not null)::numeric itl_ms
  from recent
)
select jsonb_build_object(
  'percentile', (select percentile * 100 from params),
  'stream_mode', (select stream_mode from params),
  'context_bucket', (select context_bucket from params),
  'cloudflare_colo', (select cloudflare_colo from params),
  'last_24h', jsonb_build_object(
    'total_requests', summary.requests, 'successful_requests', summary.successful_requests,
    'uptime_pct', case when summary.requests > 0 then summary.successful_requests * 100.0 / summary.requests else null end,
    'gateway_ttft_ms', summary.gateway_ttft_ms, 'avg_latency_ms', summary.gateway_ttft_ms,
    'provider_duration_ms', summary.provider_duration_ms, 'avg_generation_ms', summary.provider_duration_ms,
    'effective_throughput_tps', summary.effective_throughput_tps, 'avg_throughput', summary.effective_throughput_tps,
    'output_speed_tps', summary.output_speed_tps, 'phaseo_overhead_ms', summary.phaseo_overhead_ms,
    'tpot_ms', summary.tpot_ms, 'itl_ms', summary.itl_ms
  ),
  'prev_24h', null,
  'hourly_24h', coalesce((select jsonb_agg(jsonb_build_object(
    'bucket', bucket_start, 'requests', requests,
    'success_pct', case when requests > 0 then successful_requests * 100.0 / requests else null end,
    'gateway_ttft_ms', gateway_ttft_ms, 'avg_latency_ms', gateway_ttft_ms,
    'provider_ttft_ms', provider_ttft_ms,
    'provider_duration_ms', provider_duration_ms, 'avg_generation_ms', provider_duration_ms,
    'gateway_e2e_ms', gateway_e2e_ms, 'phaseo_overhead_ms', phaseo_overhead_ms,
    'effective_throughput_tps', effective_throughput_tps, 'avg_throughput', effective_throughput_tps,
    'output_speed_tps', output_speed_tps, 'tpot_ms', tpot_ms, 'itl_ms', itl_ms
  ) order by bucket_start) from hourly where bucket_start >= (select now_ts from params) - interval '24 hours'), '[]'::jsonb),
  'provider_uptime_24h', '[]'::jsonb,
  'provider_daily_7d', coalesce((select jsonb_agg(jsonb_build_object(
    'day', usage_day, 'provider', provider_id, 'provider_name', provider.name, 'requests', requests,
    'gateway_ttft_ms', gateway_ttft_ms, 'avg_latency_ms', gateway_ttft_ms,
    'provider_duration_ms', provider_duration_ms, 'avg_generation_ms', provider_duration_ms,
    'effective_throughput_tps', effective_throughput_tps, 'avg_throughput', effective_throughput_tps,
    'output_speed_tps', output_speed_tps, 'phaseo_overhead_ms', phaseo_overhead_ms,
    'tpot_ms', tpot_ms, 'itl_ms', itl_ms
  ) order by usage_day, provider_id)
  from provider_daily join public.v2_providers provider on provider.provider_slug = provider_id), '[]'::jsonb),
  'time_of_day_5d', '[]'::jsonb,
  'cumulative_tokens', null
) from summary;
$$;

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
security invoker
set search_path = public
as $$
with percentile_values(percentile) as (
  values (1), (5), (10), (25), (50), (75), (90), (95), (99)
),
usage_tokens as (
  select usage.request_event_id,
    sum(usage.quantity) filter (where usage.meter_key in ('input_tokens', 'input_text_tokens', 'prompt_tokens'))::numeric input_tokens
  from public.v2_request_usage usage
  where usage.meter_key in ('input_tokens', 'input_text_tokens', 'prompt_tokens')
  group by usage.request_event_id
),
base as (
  select fact.occurred_at::date usage_day, provider.provider_slug provider_id,
    provider.name provider_name, fact.success, fact.stream,
    tokens.input_tokens, fact.gateway_ttft_ms,
    fact.generation_ms provider_duration_ms, fact.throughput effective_throughput_tps,
    fact.output_speed_tps, fact.phaseo_overhead_ms, fact.tpot_ms, fact.itl_ms
  from public.v2_request_facts fact
  join public.v2_model_provider_routes route on route.provider_model_id = fact.provider_model_id
  join public.v2_providers provider on provider.provider_slug = route.provider_slug
  left join usage_tokens tokens on tokens.request_event_id = fact.request_event_id
  where coalesce(fact.routed_model_slug, fact.requested_model_slug) = lower(trim(p_model_slug))
    and fact.occurred_at >= now() - interval '7 days'
    and (nullif(upper(trim(p_cloudflare_colo)), '') is null or upper(trim(fact.cloudflare_colo)) = upper(trim(p_cloudflare_colo)))
    and (lower(p_stream_mode) not in ('stream', 'non_stream') or fact.stream = (lower(p_stream_mode) = 'stream'))
    and (
      lower(p_context_bucket) not in ('lte_4k', '4k_16k', '16k_64k', 'gt_64k')
      or (lower(p_context_bucket) = 'lte_4k' and tokens.input_tokens <= 4096)
      or (lower(p_context_bucket) = '4k_16k' and tokens.input_tokens > 4096 and tokens.input_tokens <= 16384)
      or (lower(p_context_bucket) = '16k_64k' and tokens.input_tokens > 16384 and tokens.input_tokens <= 65536)
      or (lower(p_context_bucket) = 'gt_64k' and tokens.input_tokens > 65536)
    )
)
select base.usage_day, base.provider_id, base.provider_name, count(*)::bigint,
  p.percentile,
  percentile_cont(p.percentile / 100.0) within group (order by base.gateway_ttft_ms)
    filter (where base.success and base.gateway_ttft_ms is not null)::numeric,
  percentile_cont(p.percentile / 100.0) within group (order by base.provider_duration_ms)
    filter (where base.success and base.provider_duration_ms is not null)::numeric,
  percentile_cont(p.percentile / 100.0) within group (order by base.effective_throughput_tps)
    filter (where base.success and base.effective_throughput_tps is not null)::numeric,
  percentile_cont(p.percentile / 100.0) within group (order by base.output_speed_tps)
    filter (where base.success and base.output_speed_tps is not null)::numeric,
  percentile_cont(p.percentile / 100.0) within group (order by base.phaseo_overhead_ms)
    filter (where base.success and base.phaseo_overhead_ms is not null)::numeric,
  percentile_cont(p.percentile / 100.0) within group (order by base.tpot_ms)
    filter (where base.success and base.tpot_ms is not null)::numeric,
  percentile_cont(p.percentile / 100.0) within group (order by base.itl_ms)
    filter (where base.success and base.itl_ms is not null)::numeric
from base cross join percentile_values p
group by base.usage_day, base.provider_id, base.provider_name, p.percentile
order by base.usage_day, base.provider_id, p.percentile;
$$;

grant execute on function public.get_v2_model_provider_percentile_series_v2(text, text, text, text)
  to anon, authenticated, service_role;
