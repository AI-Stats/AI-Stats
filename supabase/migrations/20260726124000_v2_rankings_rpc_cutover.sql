-- Canonical ranking RPCs over V2 daily/hourly rollups.
create or replace function public.get_public_model_rankings(
  p_time_range text default 'week',
  p_metric text default 'tokens',
  p_limit integer default 50
)
returns table (
  model_id text, provider text, requests bigint, total_tokens bigint,
  input_tokens bigint, output_tokens bigint, total_cost_usd numeric,
  median_latency_ms numeric, median_throughput numeric, success_rate numeric,
  rank integer, prev_rank integer, trend text
)
language sql stable security invoker set search_path = public
as $$
  with bounds as (
    select
      case p_time_range when 'today' then current_date when 'month' then current_date - 30 when 'year' then current_date - 365 else current_date - 7 end as since_date,
      case p_time_range when 'today' then current_date - 1 when 'month' then current_date - 60 when 'year' then current_date - 730 else current_date - 14 end as previous_since,
      case p_time_range when 'today' then current_date when 'month' then current_date - 30 when 'year' then current_date - 365 else current_date - 7 end as previous_until
  ),
  meters as (
    select meter.rollup_id,
      sum(meter.quantity) filter (where meter.meter_key in ('input_tokens','output_tokens'))::bigint as total_tokens,
      sum(meter.quantity) filter (where meter.meter_key = 'input_tokens')::bigint as input_tokens,
      sum(meter.quantity) filter (where meter.meter_key = 'output_tokens')::bigint as output_tokens
    from public.v2_public_usage_daily_meters meter
    group by meter.rollup_id
  ),
  all_periods as (
    select usage.usage_date, usage.model_slug, route.provider_slug as provider,
      usage.requests, usage.successful_requests, usage.latency_sum_ms, usage.latency_count,
      usage.throughput_sum, usage.throughput_count,
      coalesce(meter.total_tokens,0) as total_tokens,
      coalesce(meter.input_tokens,0) as input_tokens,
      coalesce(meter.output_tokens,0) as output_tokens
    from public.v2_public_usage_daily usage
    left join public.v2_model_provider_routes route on route.provider_model_id = usage.provider_model_id
    left join meters meter on meter.rollup_id = usage.rollup_id
    cross join bounds
    where usage.usage_date >= bounds.previous_since
      and lower(usage.model_slug) not in ('unknown','other')
  ),
  current_period as (
    select row.model_slug, coalesce(row.provider,'unknown') as provider,
      sum(row.requests)::bigint as requests, sum(row.successful_requests)::bigint as successes,
      sum(row.total_tokens)::bigint as total_tokens, sum(row.input_tokens)::bigint as input_tokens,
      sum(row.output_tokens)::bigint as output_tokens, sum(row.latency_sum_ms)::numeric as latency_sum,
      sum(row.latency_count)::bigint as latency_count, sum(row.throughput_sum)::numeric as throughput_sum,
      sum(row.throughput_count)::bigint as throughput_count
    from all_periods row cross join bounds where row.usage_date >= bounds.since_date
    group by row.model_slug, coalesce(row.provider,'unknown')
  ),
  previous_period as (
    select row.model_slug, coalesce(row.provider,'unknown') as provider,
      sum(row.requests)::bigint as requests, sum(row.total_tokens)::bigint as total_tokens
    from all_periods row cross join bounds
    where row.usage_date >= bounds.previous_since and row.usage_date < bounds.previous_until
    group by row.model_slug, coalesce(row.provider,'unknown')
  ),
  current_ranked as (
    select current_period.*, row_number() over (order by case p_metric when 'requests' then requests::numeric when 'cost' then 0 else total_tokens::numeric end desc, model_slug, provider)::integer as position
    from current_period where requests > 0
  ),
  previous_ranked as (
    select previous_period.*, row_number() over (order by case p_metric when 'requests' then requests::numeric when 'cost' then 0 else total_tokens::numeric end desc, model_slug, provider)::integer as position
    from previous_period where requests > 0
  )
  select current.model_slug, current.provider, current.requests, current.total_tokens,
    current.input_tokens, current.output_tokens, 0::numeric,
    round(current.latency_sum / nullif(current.latency_count,0), 0),
    round(current.throughput_sum / nullif(current.throughput_count,0), 2),
    round(current.successes::numeric / nullif(current.requests,0), 4),
    current.position, previous.position,
    case when previous.position is null then 'new' when current.position < previous.position then 'up' when current.position > previous.position then 'down' else 'same' end
  from current_ranked current
  left join previous_ranked previous using (model_slug, provider)
  order by current.position
  limit greatest(1, least(coalesce(p_limit,50),250));
$$;

create or replace function public.get_public_trending_models(
  p_limit integer default 20,
  p_min_requests integer default 0
)
returns table (
  model_id text, provider text, current_week_requests bigint,
  previous_week_requests bigint, two_weeks_ago_requests bigint,
  velocity numeric, momentum_score numeric
)
language sql stable security invoker set search_path = public
as $$
  with weekly as (
    select usage.model_slug, coalesce(route.provider_slug,'unknown') as provider,
      sum(usage.requests) filter (where usage.usage_date >= current_date - 7)::bigint as week_0,
      sum(usage.requests) filter (where usage.usage_date >= current_date - 14 and usage.usage_date < current_date - 7)::bigint as week_1,
      sum(usage.requests) filter (where usage.usage_date >= current_date - 21 and usage.usage_date < current_date - 14)::bigint as week_2
    from public.v2_public_usage_daily usage
    left join public.v2_model_provider_routes route on route.provider_model_id = usage.provider_model_id
    where usage.usage_date >= current_date - 21 and lower(usage.model_slug) not in ('unknown','other')
    group by usage.model_slug, coalesce(route.provider_slug,'unknown')
  )
  select model_slug, provider, coalesce(week_0,0), coalesce(week_1,0), coalesce(week_2,0),
    ((coalesce(week_0,0)-coalesce(week_1,0))-(coalesce(week_1,0)-coalesce(week_2,0)))::numeric,
    (((coalesce(week_0,0)-coalesce(week_1,0))-(coalesce(week_1,0)-coalesce(week_2,0)))*2.0 + (coalesce(week_0,0)-coalesce(week_1,0)))::numeric
  from weekly
  where coalesce(week_0,0) >= p_min_requests and coalesce(week_0,0) > coalesce(week_1,0)
  order by 7 desc limit greatest(1, least(coalesce(p_limit,20),100));
$$;

create or replace function public.get_public_summary_stats()
returns table (
  total_requests_24h bigint, total_tokens_24h bigint, total_models integer,
  total_providers integer, avg_latency_ms numeric, success_rate_24h numeric
)
language sql stable security invoker set search_path = public
as $$
  with meters as (
    select meter.rollup_id, sum(meter.quantity) filter (where meter.meter_key in ('input_tokens','output_tokens'))::bigint as tokens
    from public.v2_public_usage_hourly_meters meter group by meter.rollup_id
  ), aggregate as (
    select sum(usage.requests)::bigint as requests, sum(coalesce(meters.tokens,0))::bigint as tokens,
      count(distinct usage.model_slug)::integer as models, count(distinct route.provider_slug)::integer as providers,
      sum(usage.latency_sum_ms)::numeric as latency_sum, sum(usage.latency_count)::bigint as latency_count,
      sum(usage.successful_requests)::bigint as successes
    from public.v2_public_usage_hourly usage
    left join meters on meters.rollup_id = usage.rollup_id
    left join public.v2_model_provider_routes route on route.provider_model_id = usage.provider_model_id
    where usage.bucket_start >= now() - interval '24 hours'
  )
  select coalesce(requests,0), coalesce(tokens,0), coalesce(models,0), coalesce(providers,0),
    round(latency_sum / nullif(latency_count,0),0), round(successes::numeric / nullif(requests,0),4)
  from aggregate;
$$;

grant execute on function public.get_public_model_rankings(text,text,integer) to anon, authenticated, service_role;
grant execute on function public.get_public_trending_models(integer,integer) to anon, authenticated, service_role;
grant execute on function public.get_public_summary_stats() to anon, authenticated, service_role;
