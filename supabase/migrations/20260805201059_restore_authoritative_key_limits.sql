-- Key and workspace request/cost limits are operational enforcement. They must
-- count the authoritative request rows even when best-effort V2 fact ingestion
-- is delayed or fails.
do $migration$
declare
  proc record;
  definition text;
begin
  for proc in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'gateway_fetch_request_context',
        'gateway_fetch_request_context_with_reservations'
      )
      and pg_get_functiondef(p.oid) ~ 'public\.v2_rpc_gateway_requests_legacy_shape\M'
  loop
    definition := pg_get_functiondef(proc.oid);
    definition := replace(
      definition,
      'public.v2_rpc_gateway_requests_legacy_shape',
      'public.gateway_requests'
    );
    raise notice 'Restoring authoritative request accounting in %.%', proc.nspname, proc.proname;
    execute definition;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'gateway_fetch_request_context'
      and pg_get_functiondef(p.oid) ~ 'public\.v2_rpc_gateway_requests_legacy_shape\M'
  ) then
    raise exception 'Gateway context still depends on non-authoritative V2 request facts';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'gateway_fetch_request_context'
      and pg_get_functiondef(p.oid) ~ 'public\.gateway_requests\M'
  ) then
    raise exception 'Gateway context is missing authoritative gateway_requests accounting';
  end if;
end
$migration$;
