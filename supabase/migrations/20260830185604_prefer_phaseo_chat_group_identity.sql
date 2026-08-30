-- All phaseo.app paths intentionally share one public ranking group. Keep its
-- canonical public identity stable and human-readable as /apps/phaseo-chat.
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
    order by
      active.group_key,
      case
        when active.group_key = 'phaseo.app'
          and lower(btrim(active.title)) = 'phaseo chat'
        then 0
        else 1
      end,
      active.created_at asc,
      active.id asc
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

revoke all on function public.get_public_app_groups(text[]) from public;
grant execute on function public.get_public_app_groups(text[]) to service_role;

comment on function public.get_public_app_groups(text[]) is
  'Resolves public app IDs or stable slugs to canonical URL groups for the service API.';
