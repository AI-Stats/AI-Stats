-- Dedicated, service-only RPCs keep each public Rankings section independently
-- cacheable without exposing the underlying observability tables.

create or replace function public.get_public_fastest_models(
  p_days integer default 30,
  p_limit integer default 20
)
returns table (
  model_id text,
  provider text,
  requests bigint,
  cost_per_1m_tokens numeric,
  median_latency_ms numeric,
  p95_latency_ms numeric,
  median_throughput numeric,
  success_rate numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select performance.*
  from public.get_public_model_performance(
    greatest(1, least(coalesce(p_days, 30), 365)) * 24,
    0
  ) performance
  where performance.median_throughput is not null
     or performance.median_latency_ms is not null
  order by performance.requests desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.get_public_intelligence_index(
  p_limit integer default 20
)
returns table (
  benchmark_id text,
  benchmark_name text,
  benchmark_type text,
  category text,
  model_id text,
  model_name text,
  organisation_id text,
  organisation_name text,
  score numeric,
  rank bigint,
  total_models bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scored as (
    select
      benchmark.benchmark_id,
      benchmark.name as benchmark_name,
      benchmark.benchmark_type,
      benchmark.category,
      model.model_slug as model_id,
      model.name as model_name,
      model.lab_slug as organisation_id,
      lab.name as organisation_name,
      result.score_numeric as score,
      row_number() over (order by result.score_numeric desc, model.name, model.model_slug) as rank,
      count(*) over () as total_models
    from public.v2_benchmark_results result
    join public.v2_benchmarks benchmark
      on benchmark.benchmark_id = result.benchmark_id
    join public.v2_models model
      on model.model_slug = result.model_slug
     and model.hidden = false
    left join public.v2_labs lab
      on lab.lab_slug = model.lab_slug
    where result.benchmark_id = 'aa-intelligence-index-v4'
      and result.score_numeric is not null
  )
  select *
  from scored
  where rank <= greatest(1, least(coalesce(p_limit, 20), 100))
  order by rank;
$$;

create or replace function public.get_public_text_leaderboard_timeseries(
  p_time_range text default 'year',
  p_top_n integer default 20
)
returns table (
  bucket timestamptz,
  model_id text,
  requests bigint,
  tokens numeric,
  colour text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select series.*
  from public.get_public_modality_usage_timeseries(
    'text_tokens',
    coalesce(p_time_range, 'year'),
    greatest(1, least(coalesce(p_top_n, 20), 100))
  ) series;
$$;

create or replace function public.get_public_image_input_timeseries(
  p_time_range text default 'year',
  p_top_n integer default 20
)
returns table (
  bucket timestamptz,
  model_id text,
  requests bigint,
  tokens numeric,
  colour text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select series.*
  from public.get_public_modality_usage_timeseries(
    'image_inputs',
    coalesce(p_time_range, 'year'),
    greatest(1, least(coalesce(p_top_n, 20), 100))
  ) series;
$$;

create or replace function public.get_public_geography_usage(
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now(),
  p_min_requests bigint default 1,
  p_min_workspaces bigint default 1
)
returns table (
  country_code text,
  requests bigint,
  tokens numeric,
  share_percent numeric,
  workspace_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped_facts as materialized (
    select request_event_id, workspace_id, edge_country
    from public.v2_request_facts
    where occurred_at >= p_from
      and occurred_at < p_to
      and edge_country is not null
  ),
  request_tokens as (
    select
      fact.request_event_id,
      coalesce(
        nullif(sum(usage.quantity) filter (
          where usage.meter_key in ('input_tokens', 'output_tokens')
        ), 0),
        sum(usage.quantity) filter (
          where usage.meter_key in (
            'input_text_tokens', 'output_text_tokens',
            'input_image_tokens', 'output_image_tokens',
            'input_audio_tokens', 'output_audio_tokens',
            'input_video_tokens', 'output_video_tokens'
          )
        ),
        0
      ) as tokens
    from scoped_facts fact
    left join public.v2_request_usage usage
      on usage.request_event_id = fact.request_event_id
    group by fact.request_event_id
  ),
  countries as (
    select
      fact.edge_country as country_code,
      count(*)::bigint as requests,
      coalesce(sum(tokens.tokens), 0) as tokens,
      count(distinct fact.workspace_id)::bigint as workspace_count
    from scoped_facts fact
    left join request_tokens tokens
      on tokens.request_event_id = fact.request_event_id
    group by fact.edge_country
  )
  select
    country.country_code,
    country.requests,
    country.tokens,
    case
      when sum(country.requests) over () > 0
        then round(country.requests::numeric / sum(country.requests) over () * 100, 2)
      else 0
    end as share_percent,
    country.workspace_count
  from countries country
  where country.requests >= greatest(coalesce(p_min_requests, 1), 1)
    and country.workspace_count >= greatest(coalesce(p_min_workspaces, 1), 1)
  order by country.requests desc, country.country_code;
$$;

revoke all on function public.get_public_fastest_models(integer, integer) from public, anon, authenticated;
revoke all on function public.get_public_intelligence_index(integer) from public, anon, authenticated;
revoke all on function public.get_public_text_leaderboard_timeseries(text, integer) from public, anon, authenticated;
revoke all on function public.get_public_image_input_timeseries(text, integer) from public, anon, authenticated;
revoke all on function public.get_public_geography_usage(timestamptz, timestamptz, bigint, bigint) from public, anon, authenticated;

grant execute on function public.get_public_fastest_models(integer, integer) to service_role;
grant execute on function public.get_public_intelligence_index(integer) to service_role;
grant execute on function public.get_public_text_leaderboard_timeseries(text, integer) to service_role;
grant execute on function public.get_public_image_input_timeseries(text, integer) to service_role;
grant execute on function public.get_public_geography_usage(timestamptz, timestamptz, bigint, bigint) to service_role;
