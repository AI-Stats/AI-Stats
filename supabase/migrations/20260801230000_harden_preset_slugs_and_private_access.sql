drop index if exists public.presets_public_slug_key;

-- Public presets without a publisher cannot be addressed. Preserve them as
-- workspace presets instead of leaving unreachable marketplace rows behind.
update public.presets
set visibility = 'team'
where visibility = 'public'
  and created_by is null;

-- Preserve every preset while making existing publisher/slug collisions
-- deterministic before the case-insensitive unique index is installed.
with duplicate_slugs as (
  select id, row_number() over (
    partition by created_by, lower(slug)
    order by created_at, id
  ) as duplicate_number
  from public.presets
  where visibility = 'public'
    and created_by is not null
    and nullif(slug, '') is not null
)
update public.presets p
set slug = p.slug || '-' || left(p.id::text, 8)
from duplicate_slugs duplicates
where p.id = duplicates.id
  and duplicates.duplicate_number > 1;

alter table public.presets
  add constraint presets_public_requires_creator
  check (visibility <> 'public' or created_by is not null)
  not valid;

alter table public.presets
  validate constraint presets_public_requires_creator;

create unique index if not exists presets_public_publisher_slug_key
  on public.presets (created_by, lower(slug))
  where visibility = 'public';

create index if not exists presets_workspace_slug_ci_idx
  on public.presets (workspace_id, lower(slug));

comment on index public.presets_public_publisher_slug_key is
  'Public preset slugs are unique per publisher; invoke them as @publisher/slug.';

create or replace function public.marketplace_preset_fork_counts(preset_ids uuid[])
returns table (preset_id uuid, fork_count bigint)
language sql
stable
security definer
set search_path = public
as $function$
  select p.source_preset_id, count(*)::bigint
  from public.presets p
  where p.source_preset_id = any(preset_ids)
  group by p.source_preset_id;
$function$;

revoke all on function public.marketplace_preset_fork_counts(uuid[]) from public;
grant execute on function public.marketplace_preset_fork_counts(uuid[]) to anon, authenticated, service_role;

comment on function public.marketplace_preset_fork_counts(uuid[]) is
  'Returns direct fork totals for marketplace presets using the indexed source_preset_id relationship.';

-- Patch the function that is installed at migration time rather than recompiling
-- an older body. This preserves the V2 catalogue substitutions from the runtime
-- cutover while changing only preset lookup semantics.
do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;

  patched := replace(
    definition,
    'preset_name         text := null;',
    'preset_name         text := null;' || chr(10) || '  preset_publisher    text := null;'
  );

  patched := regexp_replace(
    patched,
    '-- Fetch preset configuration[\s\S]*?    limit 1;',
    $replacement$-- Fetch preset configuration. Qualified references resolve a
    -- public publisher globally; unqualified references remain workspace-local.
    if position('/' in preset_name) > 0 then
      preset_publisher := split_part(preset_name, '/', 1);
      preset_name := substring(preset_name from position('/' in preset_name) + 1);
      select jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'description', p.description,
        'config', p.config, 'visibility', p.visibility, 'publisher', u.public_profile_slug
      ) into preset_data
      from public.presets p
      join public.users u on u.user_id = p.created_by
      where lower(p.slug) = lower(preset_name)
        and p.visibility = 'public'
        and u.public_profile_enabled = true
        and lower(u.public_profile_slug) = lower(preset_publisher)
      limit 1;
    else
      select jsonb_build_object(
        'id', p.id, 'name', p.name,
        'slug', coalesce(nullif(p.slug, ''), regexp_replace(p.name, '^@', '')),
        'description', p.description, 'config', p.config, 'visibility', p.visibility
      ) into preset_data
      from public.presets p
      where lower(coalesce(nullif(p.slug, ''), regexp_replace(p.name, '^@', ''))) = lower(preset_name)
        and p.workspace_id = gateway_fetch_request_context.workspace_id
        and (
          p.visibility in ('public', 'team')
          or p.created_by = (
            select ak.created_by from public.api_keys ak
            where ak.id = gateway_fetch_request_context.api_key_id
              and ak.workspace_id = gateway_fetch_request_context.workspace_id
              and ak.is_active = true
          )
        )
      limit 1;
    end if;$replacement$
  );

  if patched = definition
    or patched not like '%preset_publisher%'
    or patched not like '%public_profile_enabled%'
  then
    raise exception 'could not patch gateway preset resolution';
  end if;

  execute patched;
end
$migration$;

comment on function public.gateway_fetch_request_context(uuid, text, text, uuid)
  is 'V2 gateway request context with workspace-local and publisher-qualified preset resolution.';
