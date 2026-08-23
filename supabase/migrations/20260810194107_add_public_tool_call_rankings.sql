-- Public, privacy-safe tool-call rankings sourced from the canonical V2 rollups.
-- Tool payloads are never stored here; only aggregate counts are exposed.

create or replace function public.get_public_tool_call_timeseries(
  p_time_range text default 'year',
  p_bucket_size text default 'week',
  p_top_n integer default 10
)
returns table (
  bucket timestamptz,
  model_id text,
  requests bigint,
  tokens bigint,
  colour text
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select case p_time_range
      when 'today' then current_date
      when 'week' then current_date - 7
      when 'month' then current_date - 30
      when 'year' then current_date - 365
      else current_date - 365
    end as since_date
  ),
  top_models as (
    select usage.model_slug
    from public.v2_public_usage_daily usage
    cross join bounds
    where usage.usage_date >= bounds.since_date
      and usage.tool_call_count > 0
      and lower(usage.model_slug) not in ('unknown', 'other')
    group by usage.model_slug
    order by sum(usage.tool_call_count) desc, usage.model_slug
    limit greatest(1, least(coalesce(p_top_n, 10), 100))
  )
  select
    (
      case p_bucket_size
        when 'day' then date_trunc('day', usage.usage_date::timestamp)
        else date_trunc('week', usage.usage_date::timestamp)
      end at time zone 'UTC'
    ) as bucket,
    usage.model_slug as model_id,
    sum(usage.tool_call_count)::bigint as requests,
    0::bigint as tokens,
    null::text as colour
  from public.v2_public_usage_daily usage
  join top_models on top_models.model_slug = usage.model_slug
  cross join bounds
  where usage.usage_date >= bounds.since_date
    and usage.tool_call_count > 0
  group by 1, usage.model_slug
  order by 1, sum(usage.tool_call_count) desc, usage.model_slug;
$$;

comment on function public.get_public_tool_call_timeseries(text, text, integer) is
  'Privacy-safe tool-call counts by canonical model and day/week from V2 public usage rollups.';

revoke all on function public.get_public_tool_call_timeseries(text, text, integer) from public;
grant execute on function public.get_public_tool_call_timeseries(text, text, integer)
  to anon, authenticated, service_role;
