-- Renew catalog leases during large reconciliations and ensure promotion only
-- reuses an existing route when the provider model identity also matches.

create or replace function public.renew_provider_catalog_sync(
  p_provider_slug text,
  p_lease_token uuid,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  update public.provider_catalog_sources
  set sync_lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 300))),
      updated_at = now()
  where provider_slug = p_provider_slug
    and sync_lease_token = p_lease_token
    and sync_lease_expires_at > now();
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.renew_provider_catalog_sync(text, uuid, integer) from public;
grant execute on function public.renew_provider_catalog_sync(text, uuid, integer) to service_role;

do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.promote_provider_catalog_candidate(uuid,text)'::regprocedure
  ) into definition;

  if position('and provider_model_slug = candidate.provider_model_slug' in definition) > 0 then
    return;
  end if;

  patched := replace(
    definition,
    'where provider_slug = candidate.provider_slug and model_slug = candidate.canonical_model_slug',
    'where provider_slug = candidate.provider_slug' || chr(10) ||
    '    and model_slug = candidate.canonical_model_slug' || chr(10) ||
    '    and provider_model_slug = candidate.provider_model_slug'
  );

  if patched = definition
     or position('and provider_model_slug = candidate.provider_model_slug' in patched) = 0 then
    raise exception 'promote_provider_catalog_candidate has an unexpected definition';
  end if;

  execute patched;
end
$migration$;

notify pgrst, 'reload schema';
