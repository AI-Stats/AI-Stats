-- Persist privacy-safe edge geography and expose scoped usage aggregates.
--
-- Country and continent come from Cloudflare request metadata. Raw IP addresses
-- are not collected or stored by this migration.

alter table public.v2_request_facts
  add column if not exists edge_country text,
  add column if not exists edge_continent text;

create or replace function public.sync_v2_request_edge_geography()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.edge_country := case
    when nullif(new.safe_metadata->>'edge_country', '') ~ '^[A-Za-z]{2}$'
      then upper(new.safe_metadata->>'edge_country')
    else null
  end;
  new.edge_continent := case
    when nullif(new.safe_metadata->>'edge_continent', '') ~ '^[A-Za-z]{2}$'
      then upper(new.safe_metadata->>'edge_continent')
    else null
  end;
  return new;
end;
$$;

drop trigger if exists sync_v2_request_edge_geography
  on public.v2_request_facts;
create trigger sync_v2_request_edge_geography
before insert or update of safe_metadata
on public.v2_request_facts
for each row execute function public.sync_v2_request_edge_geography();

-- Existing facts predate edge_country in safe_metadata, so there is no useful
-- historical backfill. New writes are populated by the trigger without a
-- rewrite of the continuously-written fact table.
create index concurrently if not exists v2_request_facts_workspace_country_time_idx
  on public.v2_request_facts (workspace_id, edge_country, occurred_at desc)
  where edge_country is not null;

create index concurrently if not exists v2_request_facts_country_time_idx
  on public.v2_request_facts (edge_country, occurred_at desc)
  where edge_country is not null;

comment on column public.v2_request_facts.edge_country is
  'ISO 3166-1 alpha-2 country inferred by Cloudflare at request time; no raw IP is stored.';
comment on column public.v2_request_facts.edge_continent is
  'Two-letter Cloudflare continent code captured at request time.';

create or replace function public.get_private_geography_usage(
  p_workspace_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  country_code text,
  continent_code text,
  requests bigint,
  tokens numeric,
  spend_nanos numeric,
  successes bigint,
  average_latency_ms numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped_facts as materialized (
    select
      f.request_event_id,
      f.edge_country,
      f.edge_continent,
      f.cost_nanos,
      f.success,
      f.latency_ms
    from public.v2_request_facts f
    where f.workspace_id = p_workspace_id
      and f.occurred_at >= p_from
      and f.occurred_at < p_to
      and f.edge_country is not null
  ),
  request_tokens as (
    select
      f.request_event_id,
      coalesce(
        nullif(sum(u.quantity) filter (
          where u.meter_key in ('input_tokens', 'output_tokens')
        ), 0),
        sum(u.quantity) filter (
          where u.meter_key in (
            'input_text_tokens', 'output_text_tokens',
            'input_image_tokens', 'output_image_tokens',
            'input_audio_tokens', 'output_audio_tokens',
            'input_video_tokens', 'output_video_tokens'
          )
        ),
        0
      ) as tokens
    from scoped_facts f
    left join public.v2_request_usage u
      on u.request_event_id = f.request_event_id
    group by f.request_event_id
  )
  select
    f.edge_country,
    max(f.edge_continent),
    count(*)::bigint,
    coalesce(sum(t.tokens), 0),
    coalesce(sum(f.cost_nanos), 0)::numeric,
    count(*) filter (where f.success)::bigint,
    avg(f.latency_ms)::numeric
  from scoped_facts f
  left join request_tokens t on t.request_event_id = f.request_event_id
  group by f.edge_country
  order by count(*) desc, f.edge_country;
$$;

create or replace function public.get_public_geography_usage(
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now(),
  p_min_requests bigint default 100,
  p_min_workspaces bigint default 3
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
    select f.request_event_id, f.workspace_id, f.edge_country
    from public.v2_request_facts f
    where f.occurred_at >= p_from
      and f.occurred_at < p_to
      and f.edge_country is not null
  ),
  request_tokens as (
    select
      f.request_event_id,
      coalesce(
        nullif(sum(u.quantity) filter (
          where u.meter_key in ('input_tokens', 'output_tokens')
        ), 0),
        sum(u.quantity) filter (
          where u.meter_key in (
            'input_text_tokens', 'output_text_tokens',
            'input_image_tokens', 'output_image_tokens',
            'input_audio_tokens', 'output_audio_tokens',
            'input_video_tokens', 'output_video_tokens'
          )
        ),
        0
      ) as tokens
    from scoped_facts f
    left join public.v2_request_usage u
      on u.request_event_id = f.request_event_id
    group by f.request_event_id
  ),
  by_country as (
    select
      f.edge_country as country_code,
      count(*)::bigint as requests,
      coalesce(sum(t.tokens), 0) as tokens,
      count(distinct f.workspace_id)::bigint as workspace_count
    from scoped_facts f
    left join request_tokens t on t.request_event_id = f.request_event_id
    group by f.edge_country
  ),
  privacy_buckets as (
    select
      case
        when requests >= greatest(p_min_requests, 1)
         and workspace_count >= greatest(p_min_workspaces, 2)
          then country_code
        else 'OTHER'
      end as country_code,
      sum(requests)::bigint as requests,
      sum(tokens) as tokens,
      case
        when requests >= greatest(p_min_requests, 1)
         and workspace_count >= greatest(p_min_workspaces, 2)
          then max(workspace_count)
        else 0
      end::bigint as workspace_count
    from by_country
    group by 1
  )
  select
    b.country_code,
    b.requests,
    b.tokens,
    case
      when sum(b.requests) over () > 0
        then round((b.requests::numeric / sum(b.requests) over ()) * 100, 2)
      else 0
    end as share_percent,
    b.workspace_count
  from privacy_buckets b
  order by b.requests desc, b.country_code;
$$;

revoke all on function public.sync_v2_request_edge_geography() from public, anon, authenticated;
revoke all on function public.get_private_geography_usage(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.get_public_geography_usage(timestamptz, timestamptz, bigint, bigint) from public, anon, authenticated;
grant execute on function public.get_private_geography_usage(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.get_public_geography_usage(timestamptz, timestamptz, bigint, bigint) to service_role;
