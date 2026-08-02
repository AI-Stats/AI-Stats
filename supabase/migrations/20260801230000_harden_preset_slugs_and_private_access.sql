drop index if exists public.presets_public_slug_key;

create unique index if not exists presets_public_publisher_slug_key
  on public.presets (created_by, slug)
  where visibility = 'public';

comment on index public.presets_public_publisher_slug_key is
  'Public preset slugs are unique per publisher; invoke them as @publisher/slug.';

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
      where p.slug = preset_name
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
      where coalesce(nullif(p.slug, ''), regexp_replace(p.name, '^@', '')) = preset_name
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
