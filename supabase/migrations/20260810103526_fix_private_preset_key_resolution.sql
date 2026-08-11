-- Private preset resolution still referenced the removed `api_keys` relation.
-- Patch the currently installed request-context function so ownership is checked
-- against the canonical key table and its status field.
do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;

  if position('from public.api_keys ak' in definition) = 0
    or position('and ak.is_active = true' in definition) = 0
  then
    raise exception 'could not find legacy private preset key lookup';
  end if;

  patched := replace(
    definition,
    'from public.api_keys ak',
    'from public.keys ak'
  );
  patched := replace(
    patched,
    'and ak.is_active = true',
    'and ak.status = ''active'''
  );

  if patched = definition
    or position('public.api_keys' in patched) > 0
    or position('ak.is_active' in patched) > 0
  then
    raise exception 'could not patch private preset key lookup';
  end if;

  execute patched;
end
$migration$;

comment on function public.gateway_fetch_request_context(uuid, text, text, uuid)
  is 'V2 gateway request context with workspace-local and publisher-qualified preset resolution using canonical API keys.';
