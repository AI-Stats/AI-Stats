-- Keep database URL grouping aligned with the web API, including userinfo
-- and bracketed IPv6 authorities.
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

create or replace function public.api_app_slug_base(p_title text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'app'
  );
$$;

create or replace function public.api_app_public_slug(
  p_title text,
  p_url text,
  p_app_id text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  with identity as (
    select
      public.api_app_slug_base(p_title) as base_slug,
      public.api_app_url_group_key(p_url, p_app_id) as group_key,
      lower(btrim(coalesce(p_url, ''))) ~ '^https?://' as is_web
  )
  select case
    -- Phaseo-owned apps keep concise routes such as /apps/phaseo-chat.
    when group_key = 'phaseo.app' then base_slug
    -- External websites receive a readable, group-owned host suffix.
    when is_web then base_slug || '--' || group_key
    -- Non-web identities retain a readable prefix and deterministic suffix.
    else base_slug || '--' ||
      trim(both '-' from regexp_replace(group_key, '[^a-z0-9]+', '-', 'g')) ||
      '-' || left(md5(group_key), 8)
  end
  from identity;
$$;

create or replace function public.get_public_app_groups(p_references text[])
returns table (
  reference text,
  app_id text,
  app_name text,
  app_url text,
  app_image_url text,
  app_category text,
  app_is_active boolean,
  app_is_public boolean,
  app_last_seen timestamptz,
  app_created_at timestamptz,
  app_updated_at timestamptz,
  member_ids text[],
  public_slug text
)
language sql
stable
set search_path = public, pg_temp
as $$
  with active as (
    select
      aa.*,
      public.api_app_url_group_key(aa.url, aa.id::text) as group_key
    from public.api_apps aa
    where aa.is_public = true
      and aa.is_active = true
  ), representatives as (
    select distinct on (active.group_key)
      active.group_key,
      active.id,
      active.title,
      active.url,
      active.image_url,
      active.category,
      active.is_active,
      active.is_public,
      active.last_seen,
      active.created_at,
      active.updated_at
    from active
    order by active.group_key, active.created_at asc, active.id asc
  ), groups as (
    select
      representatives.*,
      array_agg(active.id::text order by active.created_at asc, active.id asc) as member_ids,
      public.api_app_public_slug(
        representatives.title,
        representatives.url,
        representatives.id::text
      ) as public_slug
    from representatives
    join active using (group_key)
    group by
      representatives.group_key,
      representatives.id,
      representatives.title,
      representatives.url,
      representatives.image_url,
      representatives.category,
      representatives.is_active,
      representatives.is_public,
      representatives.last_seen,
      representatives.created_at,
      representatives.updated_at
  ), requested as (
    select unnest(coalesce(p_references, array[]::text[])) as reference
  )
  select
    requested.reference,
    groups.id::text,
    groups.title,
    groups.url,
    groups.image_url,
    groups.category,
    groups.is_active,
    groups.is_public,
    groups.last_seen,
    groups.created_at,
    groups.updated_at,
    groups.member_ids,
    groups.public_slug
  from requested
  join groups
    on requested.reference = groups.public_slug
    or requested.reference = any(groups.member_ids);
$$;

revoke all on function public.api_app_slug_base(text) from public;
revoke all on function public.api_app_public_slug(text, text, text) from public;
revoke all on function public.get_public_app_groups(text[]) from public;

grant execute on function public.api_app_slug_base(text) to service_role;
grant execute on function public.api_app_public_slug(text, text, text) to service_role;
grant execute on function public.get_public_app_groups(text[]) to service_role;

comment on function public.get_public_app_groups(text[]) is
  'Resolves public app IDs or stable slugs to canonical URL groups for the service API.';
