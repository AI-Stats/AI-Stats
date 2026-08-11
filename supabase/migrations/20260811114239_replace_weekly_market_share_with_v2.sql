-- phaseo:allow-destructive-migration reason: Retires stale weekly usage tables after replacing their reader with authoritative V2 data.
-- Replace the stale weekly market-share cache with the authoritative V2 usage
-- projections, then remove the retired weekly tables and their writer.

create or replace function public.get_public_market_share_timeseries(
  p_dimension text default 'organization',
  p_time_range text default 'year',
  p_bucket_size text default 'week',
  p_top_n integer default 8
)
returns table (
  bucket timestamptz,
  name text,
  requests bigint,
  tokens bigint,
  colour text
)
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_since timestamptz;
  v_dimension text := lower(coalesce(p_dimension, 'provider'));
  v_bucket_size text := lower(coalesce(p_bucket_size, 'day'));
begin
  case lower(coalesce(p_time_range, 'week'))
    when '24h' then v_since := now() - interval '24 hours';
    when 'today' then v_since := date_trunc('day', now());
    when 'week' then v_since := now() - interval '7 days';
    when 'month' then v_since := now() - interval '30 days';
    when 'year' then v_since := now() - interval '1 year';
    else v_since := now() - interval '1 year';
  end case;

  return query
  with source_rows as (
    select
      case
        when v_bucket_size = 'hour' then date_trunc('hour', usage.bucket_15m)
        when v_bucket_size = 'day' then date_trunc('day', usage.bucket_15m)
        when v_bucket_size = 'month' then date_trunc('month', usage.bucket_15m)
        else date_trunc('week', usage.bucket_15m)
      end as time_bucket,
      usage.canonical_model_id as model_slug,
      usage.provider,
      usage.requests,
      usage.total_tokens
    from public.v2_web_public_usage_hourly usage
    where v_bucket_size = 'hour'
      and usage.bucket_15m >= v_since

    union all

    select
      case
        when v_bucket_size = 'day' then usage.day_bucket::timestamptz
        when v_bucket_size = 'month' then date_trunc('month', usage.day_bucket::timestamp)::timestamptz
        else date_trunc('week', usage.day_bucket::timestamp)::timestamptz
      end as time_bucket,
      usage.canonical_model_id as model_slug,
      usage.provider,
      usage.requests,
      usage.total_tokens
    from public.v2_web_public_usage_daily usage
    where v_bucket_size <> 'hour'
      and usage.day_bucket >= (v_since at time zone 'utc')::date
  ),
  grouped as (
    select
      source.time_bucket,
      case
        when v_dimension = 'organization' then coalesce(nullif(lab.name, ''), nullif(model.lab_slug, ''), 'Unknown')
        else source.provider
      end as group_name,
      sum(source.requests)::bigint as request_count,
      sum(source.total_tokens)::bigint as token_count,
      case
        when v_dimension = 'organization' then max(lab.metadata ->> 'colour')
        else max(provider.metadata ->> 'colour')
      end as group_colour
    from source_rows source
    left join public.v2_models model on model.model_slug = source.model_slug
    left join public.v2_labs lab on lab.lab_slug = model.lab_slug
    left join public.v2_providers provider on provider.provider_slug = source.provider
    where (
      v_dimension = 'organization'
      and model.lab_slug is not null
    ) or (
      v_dimension <> 'organization'
      and source.provider is not null
      and source.provider <> ''
    )
    group by source.time_bucket, group_name
  ),
  top_groups as (
    select grouped.group_name
    from grouped
    group by grouped.group_name
    order by sum(grouped.request_count) desc, grouped.group_name
    limit greatest(coalesce(p_top_n, 8), 1)
  ),
  bucketed as (
    select
      grouped.time_bucket,
      case
        when grouped.group_name in (select top_groups.group_name from top_groups) then grouped.group_name
        else 'Other'
      end as group_name,
      sum(grouped.request_count)::bigint as request_count,
      sum(grouped.token_count)::bigint as token_count,
      max(case
        when grouped.group_name in (select top_groups.group_name from top_groups) then grouped.group_colour
        else null
      end) as group_colour
    from grouped
    group by grouped.time_bucket, group_name
  )
  select
    bucketed.time_bucket as bucket,
    bucketed.group_name as name,
    bucketed.request_count as requests,
    bucketed.token_count as tokens,
    bucketed.group_colour as colour
  from bucketed
  order by bucketed.time_bucket, bucketed.request_count desc;
end;
$function$;

drop function if exists public.refresh_public_usage_rollups(timestamptz);

do $assert$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* 'public\.(public_usage_weekly_models|public_usage_weekly_providers|public_usage_weekly_organisations)\b'
  ) then
    raise exception 'A function still references a retired weekly usage table';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('v', 'm')
      and pg_get_viewdef(c.oid, true) ~* 'public\.(public_usage_weekly_models|public_usage_weekly_providers|public_usage_weekly_organisations)\b'
  ) then
    raise exception 'A view still references a retired weekly usage table';
  end if;

  if to_regclass('cron.job') is not null then
    if exists (
      select 1
      from cron.job
      where command ~* 'public\.(public_usage_weekly_models|public_usage_weekly_providers|public_usage_weekly_organisations|refresh_public_usage_rollups)\b'
    ) then
      raise exception 'A cron command still references a retired weekly usage table or its writer';
    end if;
  end if;
end
$assert$;

drop table if exists public.public_usage_weekly_models;
drop table if exists public.public_usage_weekly_providers;
drop table if exists public.public_usage_weekly_organisations;

do $assert$
begin
  if to_regclass('public.public_usage_weekly_models') is not null
     or to_regclass('public.public_usage_weekly_providers') is not null
     or to_regclass('public.public_usage_weekly_organisations') is not null then
    raise exception 'Retired weekly usage tables still exist after cleanup';
  end if;
end
$assert$;
