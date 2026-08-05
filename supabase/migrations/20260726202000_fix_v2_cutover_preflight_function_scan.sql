-- The first preflight definition attempted pg_get_functiondef for aggregate
-- pg_proc rows. Restrict the catalogue scan to ordinary functions.
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
    'join pg_proc proc on pg_get_functiondef(proc.oid) ilike ''%'' || legacy.relname || ''%''',
    'join pg_proc proc on proc.prokind = ''f'' and case when proc.prokind = ''f'' then pg_get_functiondef(proc.oid) else '''' end ilike ''%'' || legacy.relname || ''%'''
  );
  execute definition;
end;
$repair$;
