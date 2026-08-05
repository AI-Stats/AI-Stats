-- Dependencies wholly contained within the legacy table set disappear in the
-- same DROP operation and are not external blockers. Also remove a legacy
-- table name that survived only inside a gateway function comment.
do $repair$
declare
  definition text;
begin
  select pg_get_functiondef(proc.oid)
  into definition
  from pg_proc proc
  join pg_namespace namespace on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and proc.proname = 'get_v2_catalogue_cutover_preflight'
    and proc.prokind = 'f';

  definition := replace(
    definition,
    'join pg_constraint con on con.confrelid = legacy.oid',
    'join pg_constraint con on con.confrelid = legacy.oid and not exists (select 1 from legacy owner where owner.oid = con.conrelid)'
  );
  execute definition;

  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;
  definition := replace(definition, '`data_api_model_aliases`', '`v2_model_aliases`');
  execute definition;
end;
$repair$;
