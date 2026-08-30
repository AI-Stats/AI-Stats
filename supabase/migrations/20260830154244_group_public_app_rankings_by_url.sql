-- Public rankings represent websites. Normalize HTTP(S) URLs to their host so
-- scheme, path, query, port, and a leading www do not split the same site.
-- Non-web app identifiers remain distinct by their full normalized URL.

create or replace function public.api_app_url_group_key(
  p_url text,
  p_app_id text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  with normalized as (
    select
      lower(btrim(coalesce(p_url, ''))) as url_value,
      regexp_replace(lower(btrim(coalesce(p_url, ''))), '^https?://', '') as without_scheme
  ), authority as (
    select
      url_value,
      split_part(split_part(split_part(without_scheme, '/', 1), '?', 1), '#', 1) as authority_value
    from normalized
  ), host_port as (
    select
      normalized.url_value,
      regexp_replace(authority.authority_value, '^.*@', '') as host_port_value
    from normalized
    cross join authority
  )
  select case
    when normalized.url_value ~ '^https?://' then
      coalesce(
        nullif(
          regexp_replace(
            case
              when host_port.host_port_value ~ '^\[' then substring(host_port.host_port_value from '^(\[[^]]+\])')
              else split_part(host_port.host_port_value, ':', 1)
            end,
            '^www\.',
            ''
          ),
          ''
        ),
        'app-id:' || p_app_id
      )
    else coalesce(nullif(normalized.url_value, ''), 'app-id:' || p_app_id)
  end
  from normalized
  cross join host_port;
$$;

revoke all on function public.api_app_url_group_key(text, text) from public;
grant execute on function public.api_app_url_group_key(text, text)
  to anon, authenticated, service_role;

create or replace function public.get_public_top_apps(
  p_limit integer default 20,
  p_time_range text default 'week'
)
returns table (
  app_id text,
  app_name text,
  requests bigint,
  tokens bigint,
  unique_models integer
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_since date;
begin
  case p_time_range
    when 'today' then v_since := v_today;
    when 'week' then v_since := v_today - 7;
    when '4w' then v_since := v_today - 28;
    when 'month' then v_since := v_today - 30;
    else v_since := v_today - 7;
  end case;

  return query
  with eligible_usage as (
    select
      public.api_app_url_group_key(aa.url, aa.id::text) as url_group,
      aa.id::text as member_id,
      aa.title as member_name,
      aa.last_seen,
      d.model_id,
      d.requests,
      d.tokens
    from public.v2_rpc_public_app_model_usage_daily d
    join public.api_apps aa on aa.id::text = d.app_id
    where d.day_bucket >= v_since
      and aa.is_public = true
      and aa.is_active = true
  ),
  member_totals as (
    select
      url_group,
      member_id,
      member_name,
      last_seen,
      sum(eligible_usage.requests)::bigint as member_requests,
      sum(eligible_usage.tokens)::bigint as member_tokens
    from eligible_usage
    group by
      eligible_usage.url_group,
      eligible_usage.member_id,
      eligible_usage.member_name,
      eligible_usage.last_seen
  ),
  representatives as (
    select distinct on (url_group)
      url_group,
      member_id,
      member_name
    from member_totals
    order by
      url_group,
      member_tokens desc,
      member_requests desc,
      last_seen desc nulls last,
      member_id
  ),
  group_totals as (
    select
      url_group,
      sum(eligible_usage.requests)::bigint as request_count,
      sum(eligible_usage.tokens)::bigint as token_count,
      count(distinct eligible_usage.model_id)::integer as model_count
    from eligible_usage
    group by eligible_usage.url_group
  )
  select
    representatives.member_id,
    representatives.member_name,
    group_totals.request_count,
    group_totals.token_count,
    group_totals.model_count
  from group_totals
  join representatives using (url_group)
  order by group_totals.token_count desc, group_totals.request_count desc
  limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.get_public_top_apps(integer, text)
  to anon, authenticated, service_role;

comment on function public.get_public_top_apps(integer, text) is
  'Ranks active public apps by combined usage for each normalized URL host.';

create or replace function public.get_public_trending_apps(
  p_limit integer default 20,
  p_min_week_tokens bigint default 0
)
returns table (
  app_id text,
  app_name text,
  current_week_tokens bigint,
  previous_week_tokens bigint,
  growth_tokens bigint,
  growth_pct numeric
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  return query
  with eligible_usage as (
    select
      public.api_app_url_group_key(aa.url, aa.id::text) as url_group,
      aa.id::text as member_id,
      aa.title as member_name,
      aa.last_seen,
      d.day_bucket,
      d.tokens
    from public.v2_rpc_public_app_model_usage_daily d
    join public.api_apps aa on aa.id::text = d.app_id
    where d.day_bucket >= v_today - 14
      and aa.is_public = true
      and aa.is_active = true
  ),
  member_totals as (
    select
      url_group,
      member_id,
      member_name,
      last_seen,
      sum(eligible_usage.tokens)::bigint as member_tokens
    from eligible_usage
    group by
      eligible_usage.url_group,
      eligible_usage.member_id,
      eligible_usage.member_name,
      eligible_usage.last_seen
  ),
  representatives as (
    select distinct on (url_group)
      url_group,
      member_id,
      member_name
    from member_totals
    order by
      url_group,
      member_tokens desc,
      last_seen desc nulls last,
      member_id
  ),
  weekly as (
    select
      url_group,
      sum(eligible_usage.tokens) filter (
        where eligible_usage.day_bucket >= v_today - 7
      )::bigint as week_0_tokens,
      sum(eligible_usage.tokens) filter (
        where eligible_usage.day_bucket >= v_today - 14
          and eligible_usage.day_bucket < v_today - 7
      )::bigint as week_1_tokens
    from eligible_usage
    group by eligible_usage.url_group
  )
  select
    representatives.member_id,
    representatives.member_name,
    coalesce(weekly.week_0_tokens, 0)::bigint,
    coalesce(weekly.week_1_tokens, 0)::bigint,
    (coalesce(weekly.week_0_tokens, 0) - coalesce(weekly.week_1_tokens, 0))::bigint,
    case
      when coalesce(weekly.week_1_tokens, 0) > 0 then
        round(
          (
            (coalesce(weekly.week_0_tokens, 0) - coalesce(weekly.week_1_tokens, 0))::numeric
            / weekly.week_1_tokens::numeric
          ) * 100,
          2
        )
      when coalesce(weekly.week_0_tokens, 0) > 0 then null
      else 0
    end
  from weekly
  join representatives using (url_group)
  where coalesce(weekly.week_0_tokens, 0) > coalesce(weekly.week_1_tokens, 0)
    and coalesce(weekly.week_0_tokens, 0) >= p_min_week_tokens
  order by
    (coalesce(weekly.week_0_tokens, 0) - coalesce(weekly.week_1_tokens, 0)) desc,
    coalesce(weekly.week_0_tokens, 0) desc
  limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.get_public_trending_apps(integer, bigint)
  to anon, authenticated, service_role;

comment on function public.get_public_trending_apps(integer, bigint) is
  'Ranks active public apps by combined token growth for each normalized URL host.';
